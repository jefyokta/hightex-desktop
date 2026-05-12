import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Chapter } from "../chapter";
// import { Provider } from "@/Provider";

export const FigureNumberPluginKey = new PluginKey("figure-number");

export const FigureNumberPlugin = new Plugin({
  key: FigureNumberPluginKey,

  state: {
    init() {
      return DecorationSet.empty;
    },
    apply(tr, old) {
      if (!tr.docChanged) return old;

      const decorations: Decoration[] = [];
      let image = 0;
      let table = 0;
      const chapter = Chapter.instance!.getChapter();
      const figureStack: {
        type: "imageFigure" | "figureTable";
        pos: number;
      }[] = [];

      tr.doc.descendants((node, pos) => {
        if (
          node.type.name === "imageFigure" ||
          node.type.name === "figureTable"
        ) {
          node.type.name === "imageFigure" && image++;
          node.type.name === "figureTable" && table++;
          figureStack.push({ type: node.type.name, pos });
        }
        if (node.type.name === "figcaption") {
          const parent = figureStack[figureStack.length - 1];
          if (!parent) {
            return;
          }
          let label =
            parent.type === "imageFigure"
              ? `Gambar ${chapter}.${image}`
              : `Tabel ${chapter}.${table}`;
          decorations.push(
            Decoration.node(pos, pos + node.nodeSize, { "data-label": label }),
          );
        }
      });

      return DecorationSet.create(tr.doc, decorations);
    },
  },

  props: {
    decorations(state) {
      return this.getState(state);
    },
  },
});
