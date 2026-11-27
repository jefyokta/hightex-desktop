import type { Editor } from "@tiptap/core";
import type { EditorState } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import type { Node as ModelNode } from "@tiptap/pm/model";
import type { Chapter } from "../chapter";
import { getEditorChapter } from "../event";
import { paginationGeometry, type PaginationOptions } from "./options";
import {
  paginationKey,
  emptyLayout,
  type PaginationState,
  type PaginationUpdate,
} from "./state";
import { PaginationSurface } from "./surface";
import { paginationSection } from "./section-context";
import { SectionComposition } from "@/document-engine/composition/section-composition";
import {
  ChapterLayoutCompiler,
  type CompiledChapter,
} from "@/document-engine/layout/chapter-compiler";
import { EditorLayoutSource } from "../chapter/layout-source";
import { documentLayoutCache } from "../document/layout-cache";
import { paginationReport } from "./report-error";
import { paginationDiagnostic } from "./diagnostic";

/** Schedule canonical chapter compilation; the live DOM only consumes published effects. */
export class PaginationView {
  readonly sources = new EditorLayoutSource();
  private readonly compiler = new ChapterLayoutCompiler(documentLayoutCache());
  private timer?: ReturnType<typeof setTimeout>;
  private frame?: number;
  private destroyed = false;
  private readonly surface: PaginationSurface;
  private task?: AbortController;
  private pendingQueued = false;

  constructor(
    private view: EditorView,
    private readonly editor: Editor,
  ) {
    this.surface = new PaginationSurface(view.dom);
    this.sources.events.on("changed", ({ reason }) => {
      this.compiler.session.invalidate(reason);
      this.schedule();
    });
    document.fonts.addEventListener("loading", this.fontsLoading);
    document.fonts.addEventListener("loadingdone", this.fontsChanged);
    view.dom.addEventListener("compositionend", this.schedule);
    view.dom.addEventListener("compositionstart", this.compositionStarted);
    view.dom.addEventListener(
      "section-composition-change",
      this.compositionChanged,
    );
    this.update(view);
  }

  update(view: EditorView, previous?: EditorState) {
    this.view = view;
    const state = paginationKey.getState(view.state)!;
    const contextChanged = this.sources.update(
      state.enabled ? getEditorChapter(this.editor) : undefined,
      view.state.doc,
    );
    const before = previous && paginationKey.getState(previous);
    this.present(state);
    if (!state.enabled) {
      this.deactivate(before?.enabled === true);
      return;
    }

    const sourceChanged = previous?.doc !== view.state.doc;
    const optionsChanged = before !== undefined && before.options !== state.options;
    if (sourceChanged) this.compiler.session.invalidate("source");
    else if (optionsChanged) this.compiler.session.invalidate("options");

    if (
      contextChanged || sourceChanged || optionsChanged ||
      before?.enabled !== state.enabled
    ) this.schedule();
  }

  private present(state: PaginationState) {
    this.surface.update(state);
    SectionComposition.forEditor(this.view.dom)?.apply(
      {
        breaks: state.layout.breaks,
        generated: state.enabled ? state.layout.generated : [],
      },
      state.layoutComposition ?? null,
    );
  }

  private deactivate(wasEnabled: boolean) {
    this.task?.abort();
    if (wasEnabled) this.compiler.session.invalidate("cancel");
    this.cancelScheduled();
    this.compiler.clearSurface();
  }

  /** Only derived plugin state is published; source and undo history are untouched. */
  private dispatch(update: PaginationUpdate) {
    this.view.dispatch(
      this.view.state.tr
        .setMeta(paginationKey, update)
        .setMeta("addToHistory", false),
    );
  }

  private schedule = () => {
    if (this.destroyed || !paginationKey.getState(this.view.state)?.enabled)
      return;
    this.markPending();
    this.task?.abort();
    this.cancelScheduled();
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.frame = requestAnimationFrame(() => {
        this.frame = undefined;
        void this.compileLayout();
      });
    }, 120);
  };

  private cancelScheduled() {
    clearTimeout(this.timer);
    this.timer = undefined;
    if (this.frame !== undefined) cancelAnimationFrame(this.frame);
    this.frame = undefined;
  }

  private markPending() {
    if (this.pendingQueued) return;
    this.pendingQueued = true;
    queueMicrotask(() => {
      this.pendingQueued = false;
      if (this.destroyed) return;
      const state = paginationKey.getState(this.view.state);
      if (!state?.enabled || state.pending) return;
      this.dispatch({ pending: true });
    });
  }

  private fontsChanged = () => this.sources.presentationChanged();
  private compositionChanged = () => {
    this.compiler.session.invalidate("options");
    this.schedule();
  };
  private fontsLoading = () => this.suspend("presentation");
  private compositionStarted = () => this.suspend("source");

  private suspend(reason: "source" | "presentation") {
    this.markPending();
    this.task?.abort();
    this.compiler.session.invalidate(reason);
    this.cancelScheduled();
  }

  private async compileLayout() {
    const state = paginationKey.getState(this.view.state);
    if (
      this.destroyed ||
      !state?.enabled ||
      this.view.composing ||
      document.fonts.status === "loading"
    )
      return;
    const chapter = getEditorChapter(this.editor);
    if (!chapter) return;
    this.sources.update(chapter, this.view.state.doc);
    const task = new AbortController();
    this.task?.abort();
    this.task = task;
    const source = this.view.state.doc;
    const options = state.options;
    let compiled: CompiledChapter | undefined;
    try {
      compiled = await this.compileChapter(chapter, source, options, task.signal);
      if (!compiled || !this.canPublish(task, source, options)) return;
      this.dispatch({ compiled });
      // Publication releases the lease. Only the compiler may retain its bounded
      // measuring surface; the result cache and the live editor never own it.
    } catch (error) {
      if (task.signal.aborted || this.destroyed) return;
      this.reportFailure(error, chapter);
    } finally {
      compiled?.destroy();
      if (this.task === task) this.task = undefined;
    }
  }

  private async compileChapter(
    chapter: Chapter,
    source: ModelNode,
    options: PaginationOptions,
    signal: AbortSignal,
  ): Promise<CompiledChapter | undefined> {
    const host = this.view.dom.closest<HTMLElement>(
      "[data-section-composition-pending],[data-section-composition-error]",
    );
    if (host?.dataset.sectionCompositionPending === "true") return;
    if (host?.dataset.sectionCompositionError)
      throw Error(host.dataset.sectionCompositionError);

    const input = await this.sources.read(source, signal);
    return this.compiler.compile(
      {
        ...input,
        source,
        sectionId: chapter.getId(),
        geometry: paginationGeometry(
          options,
          paginationSection(this.view.dom.closest(".page")),
        ),
        className: chapter.getHtmlClass(),
        counter: chapter.getNumber(),
        composition: SectionComposition.forEditor(this.view.dom)?.definition,
      },
      signal,
    );
  }

  private canPublish(
    task: AbortController,
    source: ModelNode,
    options: PaginationOptions,
  ): boolean {
    return !task.signal.aborted &&
      !this.destroyed &&
      this.view.state.doc === source &&
      paginationKey.getState(this.view.state)?.options === options;
  }

  private reportFailure(error: unknown, chapter: Chapter) {
    console.error("Editor pagination failed", error);
    this.dispatch({
      layout: { ...emptyLayout(), error: true },
      error: error instanceof Error ? error.message : String(error),
      diagnostic: paginationDiagnostic(error),
    });
    const report = paginationReport(error, `Pagination editor ${chapter.getId()}`);
    if (report) {
      report.setId(`pagination-layout:${chapter.getId()}`);
      throw report;
    }
  }

  destroy() {
    this.destroyed = true;
    this.task?.abort();
    this.cancelScheduled();
    this.compiler.dispose();
    this.sources.dispose();
    document.fonts.removeEventListener("loading", this.fontsLoading);
    document.fonts.removeEventListener("loadingdone", this.fontsChanged);
    this.view.dom.removeEventListener("compositionend", this.schedule);
    this.view.dom.removeEventListener(
      "compositionstart",
      this.compositionStarted,
    );
    this.view.dom.removeEventListener(
      "section-composition-change",
      this.compositionChanged,
    );
    this.surface.destroy();
  }
}
