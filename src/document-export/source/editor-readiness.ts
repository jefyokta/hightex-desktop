import type { Editor } from "@tiptap/core";
import type { Node as ModelNode } from "@tiptap/pm/model";
import { getEditorChapter } from "../../editor/event";
import { paginationKey } from "../../editor/pagination/state";
import type { PaginationState } from "../../editor/pagination/state";
import type { Chapter } from "../../editor/chapter/chapter";
import { waitForPrintImages } from "@/compiler/print-resources";
import { waitForContentFonts } from "../../document-engine/resources/fonts";
import { t } from "@/utils/lang";
import { citationStatus } from "../../editor/extensions/citation/status";
import { EditorPDFStateError } from "@/exception/editor-pdf-state-error";
import { abortable } from "@/utils/abortable";

interface ReadyEditorExport {
  chapter: Chapter;
  source: ModelNode;
  options: PaginationState["options"];
  plan: PaginationState["layout"];
}

/** Bind an IME request after commit, then freeze only a stable published revision. */
export function waitForEditorExport(editor: Editor, signal: AbortSignal) {
  signal.throwIfAborted();
  const chapter = getEditorChapter(editor);
  const state = !editor.isDestroyed && paginationKey.getState(editor.state);
  if (!chapter || !state)
    throw new EditorPDFStateError(t("editor.pagination.pdf_editor_not_ready"));
  if (!state.enabled)
    throw new EditorPDFStateError(t("editor.pagination.pdf_pagination_disabled"));
  return new EditorExportReadiness(editor, chapter, state.options, signal).wait();
}

/** One capture wait owns all listeners, resource waits, frames and its deadline. */
class EditorExportReadiness {
  private readonly view;
  private source?: ModelNode;
  private readonly resources = new AbortController();
  private resourcesReady = false;
  private settled = false;
  private timer?: ReturnType<typeof setTimeout>;
  private frame?: number;
  private confirmation?: number;
  private mutations?: MutationObserver;
  private resolve!: (ready: ReadyEditorExport) => void;
  private reject!: (error: unknown) => void;

  constructor(
    private readonly editor: Editor,
    private readonly chapter: Chapter,
    private readonly options: PaginationState["options"],
    private readonly signal: AbortSignal,
  ) {
    this.view = editor.view;
    // Only a request made during composition may adopt its final committed source.
    this.source = this.view.composing ? undefined : editor.state.doc;
  }

  wait(): Promise<ReadyEditorExport> {
    return new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
      this.editor.on("transaction", this.check);
      this.editor.on("destroy", this.destroyed);
      this.view.dom.addEventListener("compositionstart", this.compositionChanged);
      this.view.dom.addEventListener("compositionend", this.compositionChanged);
      document.fonts.addEventListener("loadingdone", this.check);
      this.mutations = new MutationObserver(this.compositionChanged);
      this.mutations.observe(this.view.dom, {
        subtree: true,
        attributes: true,
        childList: true,
        characterData: true,
      });
      this.signal.addEventListener("abort", this.aborted, { once: true });
      this.timer = setTimeout(() => this.fail(
        new EditorPDFStateError(t("editor.pagination.pdf_prepare_timeout")),
      ), 30000);
      this.frame = requestAnimationFrame(() => {
        this.frame = undefined;
        void this.prepareResources().catch(this.fail);
      });
      this.check();
    });
  }

  private async prepareResources() {
    const signal = this.resources.signal;
    await abortable(document.fonts.ready, signal);
    await waitForContentFonts(this.view.dom, signal);
    await waitForPrintImages(this.view.dom, signal);
    this.resourcesReady = true;
    this.check();
  }

  private current(): ReadyEditorExport | undefined {
    this.signal.throwIfAborted();
    const state = !this.editor.isDestroyed && paginationKey.getState(this.editor.state);
    if (state && !this.source && !this.view.composing) this.source = this.editor.state.doc;
    if (!state || !state.enabled || state.options !== this.options ||
        (this.source && this.editor.state.doc !== this.source) ||
        getEditorChapter(this.editor) !== this.chapter)
      throw new EditorPDFStateError(t("editor.pagination.pdf_source_changed"));
    if (state.layout.error)
      throw Error(state.error ?? t("editor.pagination.pdf_layout_failed"));
    if (!this.resourcesReady || this.view.composing || state.pending ||
        document.fonts.status !== "loaded" || citationStatus(this.view).loading ||
        this.view.dom.querySelector(
          '[data-image-status="loading"],[data-variable-status="loading"],[data-type="ref-component"] [data-status="loading"]',
        ))
      return;
    return { chapter: this.chapter, source: this.source!, options: this.options, plan: state.layout };
  }

  private check = () => {
    if (this.settled) return;
    try {
      const ready = this.current();
      if (!ready) {
        if (this.confirmation !== undefined) cancelAnimationFrame(this.confirmation);
        this.confirmation = undefined;
      } else if (this.confirmation === undefined) {
        // Let source/resource invalidations queued by publication settle over two frames.
        this.confirmation = requestAnimationFrame(() => {
          this.confirmation = requestAnimationFrame(() => this.confirm(ready.plan));
        });
      }
    } catch (error) {
      this.fail(error);
    }
  };

  private confirm(plan: ReadyEditorExport["plan"]) {
    this.confirmation = undefined;
    if (this.settled) return;
    try {
      const ready = this.current();
      if (ready?.plan === plan) {
        this.cleanup();
        this.resolve(ready);
      } else this.check();
    } catch (error) {
      this.fail(error);
    }
  }

  // ProseMirror must flush compositionend DOM changes before adopting its source.
  private compositionChanged = () => queueMicrotask(this.check);
  private aborted = () => this.fail(this.signal.reason);
  private destroyed = () => this.fail(
    new EditorPDFStateError(t("editor.pagination.pdf_source_changed")),
  );
  private fail = (error: unknown) => {
    if (this.settled) return;
    this.cleanup();
    this.reject(error);
  };

  private cleanup() {
    this.settled = true;
    clearTimeout(this.timer);
    if (this.frame !== undefined) cancelAnimationFrame(this.frame);
    if (this.confirmation !== undefined) cancelAnimationFrame(this.confirmation);
    this.editor.off("transaction", this.check);
    this.editor.off("destroy", this.destroyed);
    this.view.dom.removeEventListener("compositionstart", this.compositionChanged);
    this.view.dom.removeEventListener("compositionend", this.compositionChanged);
    document.fonts.removeEventListener("loadingdone", this.check);
    this.mutations?.disconnect();
    this.signal.removeEventListener("abort", this.aborted);
    this.resources.abort();
  }
}
