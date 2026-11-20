import type { DocumentRenderModel } from "@/types/document-snapshot";
import { ChapterGraph } from "./chapter-graph";
import { Chapter } from "./chapter";
import { Counter } from "tjsn-parser";
import { formatReferenceLabel, type RefKind } from "../extensions/ref/label";
import { contentAssets } from "@/utils/content-assets";

/** Recount source nodes in document order, then format labels shared by every section. */
export function chapterRenderContext(
  model: DocumentRenderModel,
  cache?: WeakMap<
    DocumentRenderModel["chapters"][number],
    { documentId: string; graph: ChapterGraphData }
  >,
) {
  // The host owns chapter order. Consume the supplied snapshot order, using
  // the same extraction and document-wide equation numbering as the editor.
  const graphs = model.chapters
    .filter(({ id }) => !Chapter.frozenChapter.includes(id))
    .map((chapter) => {
      const previous = cache?.get(chapter);
      if (previous?.documentId === model.document.id) return previous.graph;
      const graph = ChapterGraph.extractFromContent({
        chapter: {
          getChapter: () => chapter.id,
          getId: () => `${model.document.id}.${chapter.id}`,
          query: { isAttachmentChapter: () => chapter.id === "attachment" },
        },
        content: chapter.content,
      });
      cache?.set(chapter, { documentId: model.document.id, graph });
      return graph;
    });
  const equations = ChapterGraph.numberEquations(graphs);
  const referenceLabels: Record<RefKind, Map<string, string>> = {
    head: new Map(),
    imageFigure: new Map(),
    figureTable: new Map(),
    equation: new Map(),
  };
  const captionLabels = new Map<string, string>();
  for (const graph of graphs) {
    for (const image of graph.images) {
      const label = formatReferenceLabel("imageFigure", image.numbering);
      if (!referenceLabels.imageFigure.has(image.id))
        referenceLabels.imageFigure.set(image.id, label);
      if (!captionLabels.has(image.id)) captionLabels.set(image.id, label);
    }
    for (const table of graph.tables) {
      const label = formatReferenceLabel("figureTable", table.numbering);
      if (!referenceLabels.figureTable.has(table.id))
        referenceLabels.figureTable.set(table.id, label);
      if (!captionLabels.has(table.id)) captionLabels.set(table.id, label);
    }
    for (const heading of graph.headings) {
      if (
        heading.chapterId === `${model.document.id}.attachment` &&
        heading.level === 1 &&
        !referenceLabels.head.has(heading.id)
      )
        referenceLabels.head.set(
          heading.id,
          formatReferenceLabel(
            "head",
            Counter.getAlpha(Number(heading.numbering)),
          ),
        );
    }
  }
  for (const equation of equations)
    if (!referenceLabels.equation.has(equation.id))
      referenceLabels.equation.set(
        equation.id,
        formatReferenceLabel("equation", equation.numbering),
      );
  return {
    graphs,
    equations,
    referenceLabels,
    captionLabels,
    referenceTargets: contentAssets(model.chapters).anchors,
  };
}
