import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { MathInlineComponent } from "./math-inline-component";

export const MathInline = Node.create({
  name: "mathInline",
  group: "inline",
  inline: true,
  atom: true,

  addAttributes() {
    return {
      latex: {
        default: "",
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-math-inline]",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, { "data-math-inline": "" }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathInlineComponent);
  },
  //@ts-ignore
  addInputRules() {
    return [
      {
        find: /\s?\$\s?(.*?)\$/,
        handler: ({ range, match, commands }) => {
          const latex = match[1];
          if (!latex) {
            return;
          }
          commands.insertContentAt(range, {
            type: this.name,
            attrs: { latex },
          });
        },
      },
    ];
  },
});
