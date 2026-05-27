import { createTable } from "@tiptap/extension-table";
import { Figure } from "../figure";
import { uniqId } from "../../../utils/uniq-id";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { FigureTableComponent } from "./figure-table";

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
      addFigureTable: () =>
        this.editor
          .chain()
          .focus()
          .insertContent({
            type: "figureTable",
            attrs: {
              figureId: uniqId(),
            },

            content: [
              {
                type: "figcaption",
                content: [
                  {
                    type: "text",
                    text: "Table caption",
                  },
                ],
              },
              createTable(this.editor.schema, 3, 3, true).toJSON(),
            ],
          })
          .run(),
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
