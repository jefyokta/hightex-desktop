import type { Node as ModelNode } from "@tiptap/pm/model";
import { EditorState } from "@tiptap/pm/state";
import { DecorationSet, EditorView } from "@tiptap/pm/view";
import type { DocumentRenderModel } from "@/types/document-snapshot";
import { resolveChapterContent } from "./render-content";
import {
  paginationDecorations,
  paginationFurniture,
} from "../pagination/presentation/decorations";
import type { PageLayout } from "../pagination/flow/page-planner";
import { chapterRenderContext } from "./render-context";
import { chapterContentNodeViews } from "./content-node-views";
import type { ChapterImageResources } from "./image-resources";
import { waitForPrintImages } from "@/compiler/print-resources";
import { missingImage } from "../extensions/image/fallback";
import type { SectionLayoutIdentity } from "../../../shared/section-layout";
import { sectionDOMLocator } from "@/document-engine/layout/source-locator";
import { chapterCodePresentationPlugins } from "../extensions/code-block";

/**
 * An isolated schema view for rendering captured page plans. Presentation
 * plugins are shared; editing plugins, storage and scheduling stay outside it.
 */
export class ReadOnlyChapter {
  readonly view: EditorView;
  private rendered?: ReturnType<typeof resolveChapterContent>;
  private furniture = document.createElement("div");
  private container = document.createElement("div");
  private appliedLayout?: PageLayout;
  private revision = 0;
  private sourceOf?: ReturnType<typeof sectionDOMLocator>;
  private currentSource: ModelNode;

  get source() {
    return this.currentSource;
  }

  get layoutRevision() {
    return this.revision;
  }

  get layout(): PageLayout {
    if (!this.appliedLayout || this.view.isDestroyed)
      throw Error("Read-only chapter has no applied page plan");
    return structuredClone(this.appliedLayout);
  }

  get headingNumbers(): ReadonlyMap<string, string> {
    return new Map(
      this.rendered?.headings.map((heading) => [heading.id, heading.numbering]),
    );
  }

  get issues() {
    return this.rendered?.issues ?? [];
  }

  async waitForImages(signal: AbortSignal) {
    await waitForPrintImages(this.view.dom, signal, (image) => {
      const key = image.getAttribute("data-image-id") ?? "";
      const source = this.sourceOf?.(image);
      if (
        !this.issues.some(
          (issue) =>
            issue.kind === "image" &&
            issue.key === key &&
            issue.source?.from === source?.from,
        )
      )
        this.rendered?.issues.push({ kind: "image", key, source });
      missingImage(image);
    });
  }

  constructor(
    host: HTMLElement,
    source: ModelNode,
    model: DocumentRenderModel,
    context?: ReturnType<typeof chapterRenderContext>,
    images?: Pick<ChapterImageResources, "url">,
    nodeViews = chapterContentNodeViews(source.type.schema, host.ownerDocument),
    identity?: SectionLayoutIdentity,
  ) {
    this.currentSource = source;
    // Match EditorContent's wrapper so block margins collapse exactly as they
    // do in the live editor and LayoutSnapshot's measurement surface.
    host.append(this.container);
    this.view = new EditorView(this.container, {
      state: EditorState.create({
        doc: source,
        plugins: chapterCodePresentationPlugins(source.type.schema),
      }),
      editable: () => false,
      attributes: { class: "tiptap", "data-editor-pagination": "true" },
      nodeViews,
      dispatchTransaction: (transaction) => {
        if (transaction.docChanged)
          throw Error("Read-only chapter cannot change source content");
      },
    });
    this.view.dom.inert = true;
    this.furniture.className = "editor-pagination-sheets";
    this.furniture.inert = true;
    host.append(this.furniture);
    try {
      this.resolve(model, context, images, identity);
    } catch (error) {
      this.destroy();
      throw error;
    }
  }

  /** Replace an immutable revision while preserving unchanged schema DOM. */
  update(
    source: ModelNode,
    model: DocumentRenderModel,
    context: ReturnType<typeof chapterRenderContext>,
    images: Pick<ChapterImageResources, "url">,
    identity: SectionLayoutIdentity,
  ) {
    this.revision++;
    this.appliedLayout = undefined;
    this.furniture.replaceChildren();
    this.rendered?.dispose();
    this.rendered = undefined;
    this.currentSource = source;
    this.view.setProps({ decorations: () => DecorationSet.empty });
    this.view.updateState(
      EditorState.create({ doc: source, plugins: this.view.state.plugins }),
    );
    this.resolve(model, context, images, identity);
  }

  private resolve(
    model: DocumentRenderModel,
    context?: ReturnType<typeof chapterRenderContext>,
    images?: Pick<ChapterImageResources, "url">,
    identity?: SectionLayoutIdentity,
  ) {
    this.sourceOf = identity && sectionDOMLocator(this.view, identity);
    this.rendered = resolveChapterContent(
      this.view.dom,
      model,
      context,
      images,
      this.sourceOf,
    );
  }

  /** Reuse the editor's effects for this exact immutable source document. */
  applyLayout(source: ModelNode, layout: PageLayout) {
    if (
      this.view.isDestroyed ||
      source !== this.source ||
      layout.error ||
      !Number.isInteger(layout.pages) ||
      layout.pages < 1
    )
      throw Error("Cannot apply a stale or failed page plan");
    const snapshot = structuredClone(layout);
    const decorations = paginationDecorations(this.source, snapshot);
    this.view.setProps({ decorations: () => decorations });
    this.furniture.replaceChildren(
      paginationFurniture(snapshot.furniture ?? []),
    );
    this.appliedLayout = snapshot;
    this.revision++;
  }

  destroy() {
    this.revision++;
    this.appliedLayout = undefined;
    this.rendered?.dispose();
    this.rendered = undefined;
    this.furniture.remove();
    if (!this.view.isDestroyed) this.view.destroy();
    this.container.remove();
  }
}
