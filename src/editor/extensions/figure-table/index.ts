import { Figure } from "../figure";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { FigureTableComponent } from "./figure-table";
import { createFigureTable } from "@/editor/utils/create-figure-table";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    figureTable: {
      addFigureTable: () => boolean;
      deleteFigureTable: () => ReturnType;
    };
  }
}

export const FigureTable = Figure.extend({
  name: "figureTable",
  content: "figcaption table",
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

  addCommands(): any {
    return {
      addFigureTable: () => {
        return this.editor
          .chain()
          .focus()
          .insertContent(createFigureTable())
          .run();
      },
      deleteFigureTable: () => {
        return this.editor.chain().focus().deleteNode("figureTable");
      },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(FigureTableComponent);
  },
  addProseMirrorPlugins() {
    return [];
  },
});
