import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Chapter } from "../chapter";
import { ChapterGraph } from "../chapter/chapter-graph";
import type { Node as ModelNode } from "@tiptap/pm/model";
import { formatReferenceLabel } from "../extensions/ref/label";

/** Consume the same chapter/appendix numbering as references and snapshot rendering. */
function captionDecorations(doc: ModelNode) {
  const chapter = Chapter.instance;
  if (!chapter) return DecorationSet.empty;
  const graph = ChapterGraph.extractFromContent({
    chapter,
    content: doc.toJSON(),
  });
  const figures = {
    imageFigure: graph.images.values(),
    figureTable: graph.tables.values(),
  };
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name !== "imageFigure" && node.type.name !== "figureTable")
      return;
    const type = node.type.name;
    const figure = figures[type].next().value;
    if (!figure) return;
    const label = formatReferenceLabel(type, figure.numbering);
    node.forEach((child, offset) => {
      if (child.type.name !== "figcaption") return;
      const from = pos + 1 + offset;
      decorations.push(
        Decoration.node(from, from + child.nodeSize, { "data-label": label }),
      );
    });
  });
  return DecorationSet.create(doc, decorations);
}

export const FigureNumberPluginKey = new PluginKey("figure-number");

export const FigureNumberPlugin = new Plugin({
  key: FigureNumberPluginKey,

  state: {
    init(_config, state) {
      return captionDecorations(state.doc);
    },
    apply(tr, old) {
      if (!tr.docChanged) return old;

      return captionDecorations(tr.doc);
    },
  },

  props: {
    decorations(state) {
      return this.getState(state);
    },
  },
});
