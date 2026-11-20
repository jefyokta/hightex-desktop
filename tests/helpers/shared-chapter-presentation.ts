import { EditorState } from "@tiptap/pm/state";
import { EditorView } from "@tiptap/pm/view";
import { history, undo, undoDepth, redoDepth } from "@tiptap/pm/history";
import type { Node as ModelNode } from "@tiptap/pm/model";
import type { DocumentRenderModel } from "../../src/types/document-snapshot";
import type { PaginationGeometry } from "../../src/editor/pagination/options";
import { applyPageGeometry } from "../../src/editor/pagination/options";
import { chapterContentNodeViews } from "../../src/editor/chapter/content-node-views";
import { ChapterImageResources } from "../../src/editor/chapter/image-resources";
import { chapterRenderContext } from "../../src/editor/chapter/render-context";
import { resolveChapterContent } from "../../src/editor/chapter/render-content";
import { ReadOnlyChapter } from "../../src/editor/chapter/read-only-chapter";
import { measureEditor } from "../../src/editor/pagination/measurement/measure-chapter";
import { FlowCache } from "../../src/editor/pagination/flow/text-flow";
import { paginationDecorations, paginationFurniture } from "../../src/editor/pagination/presentation/decorations";
import { waitForPrintImages } from "../../src/compiler/print-resources";
import { waitForContentFonts } from "../../src/document-engine/resources/fonts";
import type { PageLayout } from "../../src/editor/pagination/flow/page-planner";
import type { SectionLayoutResult } from "../../shared/section-layout";
import { sectionResultDecorations } from "../../src/editor/pagination/section-result";
import { SectionComposition } from "../../src/document-engine/composition/section-composition";
import type { SectionCompositionDefinition } from "../../shared/section-layout";

/** Isolated editable/snapshot consumers of one content DOM owner. Not product wiring. */
export class SharedChapterPresentation {
  readonly images: ChapterImageResources;
  readonly editable: EditorView;
  readonly snapshot: ReadOnlyChapter;
  readonly paper: HTMLElement;
  readonly snapshotPaper: HTMLElement;
  private readonly rendered?: ReturnType<typeof resolveChapterContent>;
  private readonly furniture = document.createElement("div");
  private destroyed = false;
  readonly composition?: SectionComposition;
  readonly snapshotComposition?: SectionComposition;

  constructor(readonly source: ModelNode, model: DocumentRenderModel, readonly geometry: PaginationGeometry,
    options: { composition?: SectionCompositionDefinition; className?: string } = {}) {
    this.images = new ChapterImageResources(model.images);
    const createPaper = (visible: boolean) => {
      const paper = document.createElement("div");
      paper.className = `page ${options.className ?? "ch"}`;
      paper.dataset.paginationSurface = "";
      paper.style.cssText = visible ? "position:relative;margin:20px auto;transform:none;zoom:1" : "position:absolute;left:-100000px;top:0;margin:0;transform:none;zoom:1";
      applyPageGeometry(paper, geometry);document.body.append(paper);return paper;
    };
    this.paper = createPaper(true);this.snapshotPaper = createPaper(false);
    const wrapper = document.createElement("div");this.paper.append(wrapper);
    this.editable = new EditorView(wrapper, {
      state: EditorState.create({ doc: source, plugins: [history()] }),
      attributes: { class: "tiptap", "data-editor-pagination": "true" },
      nodeViews: chapterContentNodeViews(source.type.schema, document),
    });
    let snapshot: ReadOnlyChapter | undefined;
    try {
      const context = chapterRenderContext(model);
      this.rendered = resolveChapterContent(this.editable.dom, model, context, this.images);
      if (this.rendered.issues.length) throw Error(JSON.stringify(this.rendered.issues));
      this.snapshot = snapshot = new ReadOnlyChapter(this.snapshotPaper, source, model, context, this.images);
      this.furniture.className = "editor-pagination-sheets";this.paper.append(this.furniture);
      if (options.composition) {
        this.composition = new SectionComposition(document, options.composition);
        this.composition.body.append(wrapper);this.paper.prepend(this.composition.element);
        this.snapshotComposition = new SectionComposition(document, options.composition);
        this.snapshotComposition.body.append(this.snapshot.view.dom.parentElement!);
        this.snapshotPaper.prepend(this.snapshotComposition.element);
      }
    } catch (error) {
      snapshot?.destroy();this.rendered?.dispose();this.editable.destroy();this.paper.remove();this.snapshotPaper.remove();this.images.dispose();throw error;
    }
  }

  async measureSnapshot(signal: AbortSignal) {
    if (this.destroyed) throw Error("Shared presentation proof is destroyed");
    for (const root of [this.editable.dom, this.snapshot.view.dom]) {
      await waitForPrintImages(root, signal);await waitForContentFonts(root, signal);
    }
    await document.fonts.ready;signal.throwIfAborted();
    const cache = new FlowCache();let previous = "", plan: PageLayout | null = null;
    for (let pass = 0; pass < 4; pass++) {
      plan = await measureEditor(this.snapshot.view, cache, signal, this.geometry, this.snapshotComposition);
      if (!plan || plan.error) throw Error("Snapshot proof measurement failed");
      this.snapshot.applyLayout(this.source, plan);
      this.snapshotComposition?.apply({ breaks: plan.breaks, generated: plan.generated });
      const identity = JSON.stringify(plan);
      if (identity === previous) break;
      if (pass === 3) throw Error("Snapshot proof layout did not converge");
      previous = identity;
    }
    return { plan: plan! };
  }

  async layout(signal: AbortSignal) {
    const { plan } = await this.measureSnapshot(signal);
    const independent = await measureEditor(this.editable, new FlowCache(), signal, this.geometry, this.composition);
    const decorations = paginationDecorations(this.source, plan!);
    this.editable.setProps({ decorations: () => decorations });
    this.furniture.replaceChildren(paginationFurniture(plan!.furniture ?? []));
    this.composition?.apply({ breaks: plan.breaks, generated: plan.generated });
    return { plan: plan!, independent, snapshotSourceMatches: this.snapshot.source.eq(this.editable.state.doc) };
  }

  applyResult(result: Readonly<SectionLayoutResult>) {
    if (this.destroyed) throw Error("Shared presentation proof is destroyed");
    const decorations = sectionResultDecorations(this.editable.state.doc, this.source, result);
    const furniture = paginationFurniture(result.effects.furniture ?? []);
    if (JSON.stringify(result.composition) !== JSON.stringify(this.composition?.definition)) throw Error("Composition revision differs from published result");
    this.composition?.apply(result.effects);
    this.editable.setProps({ decorations: () => decorations });this.furniture.replaceChildren(furniture);
  }

  probeHistory() {
    const before = this.editable.state.doc, selection = this.editable.state.selection;
    const position = before.firstChild!.nodeSize + 1;
    this.editable.dispatch(this.editable.state.tr.insertText("x", position));
    const inserted = this.editable.state.doc.textContent.length === before.textContent.length + 1;
    const undoBefore = undoDepth(this.editable.state);
    const undone = undo(this.editable.state, this.editable.dispatch);
    return { inserted, undoBefore, undone, sourceRestored: this.editable.state.doc.eq(before), selectionRestored: this.editable.state.selection.eq(selection), redoDepth: redoDepth(this.editable.state) };
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.snapshot.destroy();this.rendered?.dispose();this.editable.destroy();
    this.paper.remove();this.snapshotPaper.remove();this.images.dispose();
  }
}

/** Exercise ownership on successful and aborted jobs, with the original source unchanged. */
export async function auditPresentationLifecycle(source: ModelNode, model: DocumentRenderModel, geometry: PaginationGeometry) {
  const before = document.querySelectorAll("[data-pagination-surface]").length;
  let cancelled = 0, completed = 0, destroyed = 0;
  for (let index = 0; index < 20; index++) {
    const presentation = new SharedChapterPresentation(source, model, geometry);
    const task = new AbortController();
    const reason = new Error("Lifecycle cancellation probe");
    if (index % 2) task.abort(reason);
    try {
      await presentation.layout(task.signal);
      if (task.signal.aborted) throw Error("Cancelled layout published a result");
      completed++;
    } catch (error) {
      if (error !== reason) throw error;
      cancelled++;
    } finally {
      presentation.destroy();
      if (presentation.editable.isDestroyed && presentation.snapshot.view.isDestroyed) destroyed++;
    }
  }
  return { completed, cancelled, destroyed, surfacesBefore: before, surfacesAfter: document.querySelectorAll("[data-pagination-surface]").length };
}
