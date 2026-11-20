import { Figure } from "../figure";
import { chapterContentNodeView } from "@/editor/chapter/content-node-view";
import { FigureTableComponent } from "./figure-table";
import { createFigureTable } from "@/editor/utils/create-figure-table";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    figureTable: {
      addFigureTable: () => ReturnType;
      deleteFigureTable: () => ReturnType;
    };
  }
}

export const FigureTable = Figure.extend({
  name: "figureTable",
  content: "figcaption table",
  extendNodeSchema(extension) {
    return extension.name === "figureTable"
      ? { editorPagination: { kind: "table", content: "table" } }
      : {};
  },
  addAttributes() {
    return {
      ...this.parent?.(),
      groupId: {
        default: "",
        renderHTML: (attributes) => ({
          "data-groupid": attributes.groupId || null,
        }),
      },
    };
  },

  addCommands() {
    return {
      addFigureTable:
        () =>
        ({ chain }) => {
          return chain().focus().insertContent(createFigureTable()).run();
        },
      deleteFigureTable:
        () =>
        ({ chain }) => {
          return chain().focus().deleteNode("figureTable").run();
        },
    };
  },
  addNodeView() {
    return chapterContentNodeView(FigureTableComponent);
  },
  addProseMirrorPlugins() {
    return [];
  },
});
