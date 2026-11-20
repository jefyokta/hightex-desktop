import type { DocumentPresentation } from "../resources/contracts";
import { getSchema } from "@tiptap/core";
import { ChapterExtensions } from "@/editor/chapter/chapter-extensions";
import { chapterSnapshotSource } from "@/editor/chapter/snapshot-source";
import { ChapterImageResources } from "@/editor/chapter/image-resources";
import { chapterRenderContext } from "@/editor/chapter/render-context";
import { chapterLayoutResources } from "@/editor/chapter/layout-dependencies";
import { abortable } from "@/utils/abortable";
import {
  sectionGeometry,
  type PaginationGeometry,
} from "@/editor/pagination/options";
import { ChapterLayoutCompiler } from "../layout/chapter-compiler";
import { editorSectionOutline } from "./editor-outline";
import { chapterPages } from "./chapter-pages";
import { documentSourceTargets } from "../projection/source-map";
import type { SectionLayoutCache } from "../layout/layout-cache";
import type { DocumentRenderModel } from "@/types/document-snapshot";
import type {
  EditorSection,
  RenderedSection,
  SectionRenderContext,
  SectionRenderer,
} from "@/types/document-engine";

/** Adapt compiled chapter results to document pages; it does not choose page breaks. */
export class EditorSectionRenderer implements SectionRenderer<EditorSection> {
  private readonly compiler;
  private readonly images;
  private readonly context;
  private readonly sourceTargets;
  private presentation?: Promise<string>;

  constructor(
    private readonly base: PaginationGeometry,
    private readonly model: DocumentRenderModel,
    private readonly resources: DocumentPresentation,
    cache?: SectionLayoutCache,
  ) {
    this.compiler = new ChapterLayoutCompiler(cache);
    this.images = new ChapterImageResources(model.images);
    this.context = chapterRenderContext(model);
    this.sourceTargets = documentSourceTargets(
      model.chapters.map((item) => ({
        id: `${model.document.id}.${item.id}`,
        content: item.content,
      })),
    );
  }

  async render(
    definition: EditorSection,
    { signal }: SectionRenderContext,
  ): Promise<RenderedSection> {
    this.presentation ??= this.resources.layoutFingerprint();
    const geometry = sectionGeometry(this.base, definition.options);
    const source = chapterSnapshotSource(
      getSchema(ChapterExtensions.contentSchema(definition.chapter)),
      definition.nodes,
      `${this.model.document.id}.${definition.chapter}`,
    );
    const [resourcesHash, presentationHash] = await abortable(
      Promise.all([
        chapterLayoutResources(
          source,
          this.model,
          this.context,
          this.sourceTargets,
          this.images,
        ),
        this.presentation,
      ]),
      signal,
    );
    const compiled = await this.compiler.compile(
      {
        sectionId: `${this.model.document.id}.${definition.chapter}`,
        source,
        model: this.model,
        geometry,
        className: definition.className,
        counter: definition.counter,
        composition: definition.composition,
        images: this.images,
        context: this.context,
        sourceTargets: this.sourceTargets,
        resourcesHash,
        presentationHash,
      },
      signal,
    );
    const { result, paper, root } = compiled;
    try {
      const outline = editorSectionOutline(compiled, definition, root);
      const pages = chapterPages(
        { paper, root, pages: result.pages, sources: result.sources },
        geometry,
      );
      return {
        pages,
        outline,
        issues: result.issues,
        identity: {
          ...result.identity,
          pages: result.pages,
          geometry: result.geometry,
          effects: result.effects,
          decisions: result.decisions,
        },
        destroy() {
          pages.forEach((page) => page.element.remove());
          compiled.destroy();
        },
      };
    } catch (error) {
      compiled.destroy();
      throw error;
    }
  }

  destroy() {
    this.compiler.dispose();
    this.images.dispose();
  }
}
