import type { Node as ModelNode } from "@tiptap/pm/model";
import type { DocumentRenderModel } from "@/types/document-snapshot";
import type { PaginationGeometry } from "@/editor/pagination/options";
import type {
  SectionCompositionDefinition,
  SectionLayoutResult,
} from "../../../shared/section-layout";
import { ReadOnlyChapter } from "@/editor/chapter/read-only-chapter";
import { ChapterImageResources } from "@/editor/chapter/image-resources";
import type { chapterRenderContext } from "@/editor/chapter/render-context";
import { measureEditor } from "@/editor/pagination/measurement/measure-chapter";
import { FlowCache } from "@/editor/pagination/flow/text-flow";
import { applyPageGeometry } from "@/editor/pagination/options";
import { waitForPrintImages } from "@/compiler/print-resources";
import { waitForContentFonts } from "@/document-engine/resources/fonts";
import { PageImageSnapshot } from "@/editor/pagination/measurement/image-snapshot";
import { assertPageImagePlacement } from "@/editor/pagination/measurement/image-placement";
import { PaginationImageError } from "@/exception/pagination-image-error";
import { sha256Text } from "@/utils/sha256";
import { abortable } from "@/utils/abortable";
import { SectionComposition } from "../composition/section-composition";
import { SectionLayoutSession } from "./layout-session";
import { sectionSourceLocator } from "./source-locator";
import { sectionSourceMap } from "../projection/source-map";
import { sectionLayoutEffects } from "./layout-effects";
import { sectionLayoutDecisions } from "./layout-decisions";
import { SectionViewport } from "../projection/section-viewport";
import type { PageLayout } from "@/editor/pagination/flow/page-planner";
import type { SectionLayoutCache } from "./layout-cache";
import { PaginationLayoutError } from "@/exception/pagination-layout-error";

interface ChapterLayoutInput {
  sectionId: string;
  source: ModelNode;
  model: DocumentRenderModel;
  geometry: PaginationGeometry;
  className: string;
  counter?: number;
  composition?: SectionCompositionDefinition;
  images: Pick<ChapterImageResources, "data">;
  resourcesHash: string;
  presentationHash: string;
  context: ReturnType<typeof chapterRenderContext>;
  sourceTargets: ReadonlyMap<string, string>;
}
export interface CompiledChapter {
  readonly result: Readonly<SectionLayoutResult>;
  readonly source: ModelNode;
  readonly headingNumbers: ReadonlyMap<string, string>;
  readonly captionLabels: ReadonlyMap<string, string>;
  readonly paper: HTMLElement;
  readonly root: HTMLElement;
  readonly plan: PageLayout;
  destroy(): void;
}

const hash = (value: unknown) =>
  sha256Text(JSON.stringify(value));

interface LayoutSurface {
  key: string;
  paper: HTMLElement;
  chapter: ReadOnlyChapter;
  composition?: SectionComposition;
}

/** One canonical measuring owner for editable sections. Adapters supply resolved data only. */
export class ChapterLayoutCompiler {
  readonly session = new SectionLayoutSession((error) =>
    console.error("Chapter layout observer failed", error),
  );
  private readonly compiled = new Set<CompiledChapter>();
  private readonly flow = new FlowCache();
  private flowContext = "";
  private retained?: LayoutSurface;
  private surfaceEpoch = 0;
  private disposed = false;

  constructor(private readonly cache?: SectionLayoutCache) {}

  async compile(
    input: ChapterLayoutInput,
    signal: AbortSignal,
  ): Promise<CompiledChapter> {
    const { source, geometry, model } = input;
    const [sourceHash, optionsHash] = await abortable(
      Promise.all([
        hash(source.toJSON()),
        hash([geometry, input.className, input.counter, input.composition]),
      ]),
      signal,
    );
    const job = this.session.begin(
      {
        documentId: model.document.id,
        sectionId: input.sectionId,
        sourceHash,
        optionsHash,
        resourcesHash: input.resourcesHash,
        presentationHash: input.presentationHash,
      },
      signal,
    );
    const cached = this.cache?.get(job.identity);
    if (cached) {
      const template = document.createElement("template");
      template.innerHTML = cached.result.html;
      const paper = template.content.firstElementChild as HTMLElement;
      Object.assign(paper.style, {
        position: "absolute",
        left: "-100000px",
        top: "0px",
      });
      document.body.append(paper);
      try {
        await waitForPrintImages(paper, job.signal);
        await waitForContentFonts(paper, job.signal);
        const result = this.session.publish(job, cached.result);
        return this.own(input, result, paper, cached.plan);
      } catch (error) {
        paper.remove();
        if (!job.signal.aborted) this.session.invalidate("cancel", error);
        throw error;
      }
    }
    const key = JSON.stringify([
      input.sectionId,
      optionsHash,
      input.resourcesHash,
      input.presentationHash,
      input.context.graphs
        .flatMap((graph) => graph.headings)
        .filter((heading) => heading.chapterId === input.sectionId)
        .map((heading) => [heading.id, heading.numbering]),
    ]);
    if (
      this.retained &&
      (this.retained.key !== key ||
        this.retained.chapter.source.type.schema !== source.type.schema)
    )
      this.clearSurface();
    const retained = this.retained;
    this.retained = undefined;
    const surfaceEpoch = this.surfaceEpoch;
    const paper = retained?.paper ?? document.createElement("div");
    if (!retained) {
      paper.className = `page ${input.className}`;
      paper.dataset.paginationSurface = "";
      paper.style.cssText =
        "position:absolute;left:-100000px;top:0;margin:0;transform:none;zoom:1";
      paper.style.setProperty("--start-counter", String(input.counter ?? 0));
      applyPageGeometry(paper, geometry);
      document.body.append(paper);
    }
    let chapter = retained?.chapter;
    let composition = retained?.composition;
    try {
      const urls = new Map<string, string | undefined>();
      const keys = new Set<string>();
      source.descendants((node) => {
        if (node.type.name === "image") keys.add(node.attrs.src);
      });
      await abortable(
        Promise.all(
          Array.from(keys, async (key) => {
            urls.set(key, await input.images.data(key));
          }),
        ),
        job.signal,
      );
      if (chapter) {
        composition?.apply({ breaks: [], generated: [] });
        chapter.update(
          source,
          model,
          input.context,
          { url: (key) => urls.get(key) },
          job.identity,
        );
      } else {
        chapter = new ReadOnlyChapter(
          paper,
          source,
          model,
          input.context,
          { url: (key) => urls.get(key) },
          undefined,
          job.identity,
        );
        composition =
          input.composition &&
          new SectionComposition(document, input.composition);
        if (composition) {
          composition.body.append(chapter.view.dom.parentElement!);
          paper.prepend(composition.element);
        }
      }
      await chapter.waitForImages(job.signal);
      await waitForPrintImages(paper, job.signal);
      await waitForContentFonts(paper, job.signal);
      await abortable(document.fonts.ready, job.signal);
      if (key !== this.flowContext) {
        this.flow.clear();
        this.flowContext = key;
      }
      const plan = await this.paginate(chapter, input, job.signal, composition);
      const origin = paper.getBoundingClientRect();
      for (const [index, entry] of new PageImageSnapshot(
        chapter.view,
      ).entries.entries()) {
        try {
          if (!entry.image)
            throw new PaginationImageError({
              code: "pagination.image.unavailable",
              image: index + 1,
            });
          assertPageImagePlacement(
            entry.image.getBoundingClientRect(),
            origin,
            geometry,
            index + 1,
          );
        } catch (error) {
          if (!(error instanceof PaginationImageError)) throw error;
          throw new PaginationImageError(
            error.details,
            sectionSourceLocator(source, job.identity, entry.from, entry.to),
          );
        }
      }
      const mapped = sectionSourceMap(
        chapter.view,
        job.identity,
        geometry,
        input.sourceTargets,
        plan.anchors,
      );
      const frame = new SectionViewport(paper, geometry, plan.pages);
      let html: string;
      try {
        html = frame.context.outerHTML;
      } finally {
        frame.dispose();
      }
      const result = this.session.publish(job, {
        identity: job.identity,
        sourceSize: source.content.size,
        pages: plan.pages,
        geometry,
        html,
        ...mapped,
        decisions: sectionLayoutDecisions(
          source,
          job.identity,
          plan.decisions ?? [],
        ),
        effects: sectionLayoutEffects(plan),
        composition: input.composition,
        issues: [
          ...chapter.issues,
          ...(plan.issues ?? []).map((issue) => ({
            kind: issue.kind,
            key: issue.key,
            message: issue.message,
            source: sectionSourceLocator(
              source,
              job.identity,
              issue.from,
              issue.to,
            ),
          })),
        ],
      });
      this.cache?.set(result, plan);
      const surface: LayoutSurface = { key, paper, chapter, composition };
      return this.own(input, result, paper, plan, () => {
        if (
          this.disposed ||
          surfaceEpoch !== this.surfaceEpoch ||
          surface.key !== this.flowContext
        ) {
          surface.chapter.destroy();
          surface.paper.remove();
        } else {
          this.clearSurface();
          this.retained = surface;
        }
      });
    } catch (error) {
      chapter?.destroy();
      paper.remove();
      if (!job.signal.aborted) this.session.invalidate("cancel", error);
      if (error instanceof PaginationLayoutError && !error.source)
        throw new PaginationLayoutError(
          error.cause,
          error.range,
          sectionSourceLocator(
            source,
            job.identity,
            error.range.from,
            error.range.to,
          ),
        );
      throw error;
    }
  }

  /** Settle one canonical surface; adapters never carry a second convergence loop. */
  private async paginate(
    chapter: ReadOnlyChapter,
    input: ChapterLayoutInput,
    signal: AbortSignal,
    composition?: SectionComposition,
  ) {
    let previous = "";
    for (let pass = 0; pass < 4; pass++) {
      const plan = await measureEditor(chapter.view, this.flow, signal, input.geometry, composition);
      if (!plan)
        throw Error(`Chapter ${input.sectionId} measuring surface is disconnected or has zero width`);
      chapter.applyLayout(input.source, plan);
      composition?.apply({ breaks: plan.breaks, generated: plan.generated });
      const signature = JSON.stringify(plan);
      if (signature === previous) return chapter.layout;
      previous = signature;
    }
    throw Error(`Chapter ${input.sectionId} pagination did not settle after 4 passes`);
  }

  private own(
    input: ChapterLayoutInput,
    result: Readonly<SectionLayoutResult>,
    paper: HTMLElement,
    plan: PageLayout,
    release = () => paper.remove(),
  ) {
    const compiled: CompiledChapter = {
      result,
      source: input.source,
      paper,
      plan,
      root:
        paper.querySelector<HTMLElement>("[data-section-composition]") ??
        paper.querySelector<HTMLElement>(".tiptap")!,
      headingNumbers: new Map(
        input.context.graphs
          .flatMap((graph) => graph.headings)
          .slice()
          .reverse()
          .map((item) => [item.id, item.numbering]),
      ),
      captionLabels: input.context.captionLabels,
      destroy: () => {
        if (this.compiled.delete(compiled)) release();
      },
    };
    this.compiled.add(compiled);
    return compiled;
  }

  /** Keep at most one reusable surface, owned by this compiler rather than its result cache. */
  clearSurface() {
    this.surfaceEpoch++;
    this.retained?.chapter.destroy();
    this.retained?.paper.remove();
    this.retained = undefined;
  }

  dispose() {
    this.disposed = true;
    this.session.dispose();
    this.clearSurface();
    this.flow.clear();
    this.flowContext = "";
    for (const compiled of this.compiled) compiled.destroy();
  }
}
