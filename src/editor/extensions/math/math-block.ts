import { InputRule, Node, nodePasteRule } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import katex from "katex";
import { MathBlockComponent } from "./math-block-component";

const MathBlockRegex = /^\$\$\s*([\w\S]+?)\s*\$\$\s*$/;
const MathBlockPasteRegex = /^\$\$\s*([\s\S]+?)\s*\$\$$/g;

export const MathBlock = Node.create({
  name: "blockMath",
  group: "block",
  atom: true,
  addAttributes() {
    return {
      latex: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-latex") || "",
        renderHTML: (attributes: { latex?: string }) => ({
          latex: attributes.latex,
        }),
      },
      id: {
        default: null,
        renderHTML(attributes) {
          return { id: attributes.id };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-latex]" }];
  },

  renderHTML({ node }) {
    return [
      "div",
      { "data-latex": node.attrs.latex },
      katex.renderToString(node.attrs.latex, {
        throwOnError: false,
        displayMode: true,
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathBlockComponent);
  },

  addInputRules() {
    return [
      new InputRule({
        find: MathBlockRegex,
        handler: ({ range, match, chain }) => {
          const [_, latex] = match;
          chain()
            .deleteRange(range)
            .insertContentAt(range.from, {
              type: "blockMath",
              attrs: { latex: latex.trim() },
            })
            .run();
        },
      }),
    ];
  },
  addPasteRules() {
    return [
      nodePasteRule({
        find: MathBlockPasteRegex,
        type: this.type,
        getAttributes: (match) => ({ latex: match[1].trim() }),
      }),
    ];
  },
});
