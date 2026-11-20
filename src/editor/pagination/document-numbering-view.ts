import type { Editor } from "@tiptap/core";
import type { EditorState } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { getEditorChapter } from "../event";
import type { Chapter } from "../chapter/chapter";
import type { EditorLayoutSource } from "../chapter/layout-source";
import { abortable } from "@/utils/abortable";
import { paginationKey, type DocumentNumberingState } from "./state";
import { paginationReport } from "./report-error";
import { paginationDiagnostic } from "./diagnostic";

/** Own derived document labels; never dispatch source edits or mount another editable chapter. */
export class DocumentNumberingView {
  private chapter?: Chapter;
  private task?: AbortController;
  private timer?: ReturnType<typeof setTimeout>;
  private destroyed = false;
  private invalidationQueued = false;
  private theme: MutationObserver;

  constructor(
    private readonly editor: Editor,
    private readonly sources: EditorLayoutSource,
  ) {
    sources.events.on("changed", this.invalidate);
    this.theme = new MutationObserver(this.invalidate);
    this.theme.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    document.fonts.addEventListener("loading", this.invalidate);
    document.fonts.addEventListener("loadingdone", this.invalidate);
  }

  update(view: EditorView, previous?: EditorState) {
    const state = paginationKey.getState(view.state);
    const chapter = getEditorChapter(this.editor);
    if (
      !state?.enabled ||
      state.options.documentNumbering === false ||
      !chapter
    ) {
      this.stop();
      return;
    }
    if (chapter !== this.chapter) {
      this.stop();
      this.chapter = chapter;
    }
    const before = previous && paginationKey.getState(previous);
    if (
      previous &&
      (previous.doc !== view.state.doc ||
        before?.options !== state.options ||
        (state.pending && !before?.pending))
    )
      this.invalidate();
    if (!state.numbering || state.numbering.pending)
      this.schedule();
  }

  private publish(numbering: DocumentNumberingState) {
    if (this.destroyed || this.editor.isDestroyed) return;
    this.editor.view.dispatch(
      this.editor.state.tr
        .setMeta(paginationKey, { numbering })
        .setMeta("addToHistory", false),
    );
  }

  private invalidate = () => {
    if (this.destroyed || !this.chapter || this.editor.isDestroyed) return;
    this.cancelPending();
    if (this.invalidationQueued) return;
    this.invalidationQueued = true;
    // Invalidation also runs inside a ProseMirror view update; never nest dispatch.
    queueMicrotask(() => {
      this.invalidationQueued = false;
      if (this.destroyed || this.editor.isDestroyed || !this.chapter) return;
      const state = paginationKey.getState(this.editor.state);
      if (!state?.enabled || state.options.documentNumbering === false) return;
      if (!state.numbering?.pending)
        this.publish({ labels: state.numbering?.labels, pending: true });
      this.schedule();
    });
  };

  private schedule() {
    if (this.task || this.timer !== undefined || !this.readyState()) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.refresh();
    }, 600);
  }

  /** A numbering job starts only after its local chapter layout is usable. */
  private readyState() {
    if (this.destroyed || this.editor.isDestroyed || !this.chapter) return;
    const state = paginationKey.getState(this.editor.state);
    if (state?.enabled && state.options.documentNumbering !== false &&
        !state.pending && !state.layout.error && !this.editor.view.composing)
      return state;
  }

  private async refresh() {
    const state = this.readyState(),
      chapter = this.chapter;
    if (!state || !chapter) return;
    const task = new AbortController();
    this.task = task;
    const source = this.editor.state.doc,
      options = state.options,
      plan = state.layout;
    try {
      await abortable(this.sources.ready, task.signal);
      const { editorDocumentNumbers } =
        await import("../../document-export/document-numbering");
      task.signal.throwIfAborted();
      const result = await editorDocumentNumbers(this.editor, task.signal);
      const latest =
        !this.editor.isDestroyed && paginationKey.getState(this.editor.state);
      if (
        task.signal.aborted ||
        this.destroyed ||
        this.chapter !== chapter ||
        !latest ||
        this.editor.state.doc !== source ||
        latest.options !== options ||
        latest.layout !== plan
      ) {
        if (!task.signal.aborted) this.invalidate();
        return;
      }
      if (result.labels.length !== latest.layout.pages)
        throw Error(`Document and editor page counts differ for ${chapter.getId()}: document=${result.labels.length}, editor=${latest.layout.pages}`);
      this.publish({ labels: result.labels, pending: false });
    } catch (error) {
      if (!task.signal.aborted && !this.destroyed) {
        this.publish({
          pending: false,
          error: error instanceof Error ? error.message : String(error),
          diagnostic: paginationDiagnostic(error),
        });
        const report = paginationReport(
          error,
          `Nomor halaman dokumen ${chapter.getDocumentId()}`,
        );
        if (report)
          throw report.setId(`pagination-numbering:${chapter.getDocumentId()}`);
      }
    } finally {
      if (this.task === task) this.task = undefined;
    }
  }

  private cancelPending() {
    this.task?.abort();
    this.task = undefined;
    clearTimeout(this.timer);
    this.timer = undefined;
  }

  private stop() {
    this.cancelPending();
    this.chapter = undefined;
  }

  destroy() {
    this.destroyed = true;
    this.stop();
    this.sources.events.off("changed", this.invalidate);
    this.theme.disconnect();
    document.fonts.removeEventListener("loading", this.invalidate);
    document.fonts.removeEventListener("loadingdone", this.invalidate);
  }
}
