import { FigureNumberPlugin } from "@/editor/plugins/figure-number";
import { mergeAttributes, Node } from "@tiptap/core";

export const FigureCaption = Node.create({
  name: "figcaption",

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  content: "inline*",

  selectable: false,

  draggable: false,

  parseHTML() {
    return [
      {
        tag: "figcaption",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["figcaption", mergeAttributes(HTMLAttributes), 0];
  },

  addProseMirrorPlugins() {
    return [FigureNumberPlugin];
  },
});
