import { mergeAttributes } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import { NodePasteRule } from "./../utilites";
import { uniqId } from "../../../utils/uniq-id";
import { UUID } from "../uuid";

export interface FigureAttributes {
  figureId: string;
}
export const Figure = UUID.extend<FigureAttributes>({
  name: "figure",
  defining: true,
  addAttributes() {
    return {
      ...this.parent?.(),
      figureId: {
        default: null,
        parseHTML: (element) =>
          element.getAttribute("data-figureid") || uniqId(),
        renderHTML: (attributes) => ({ "data-figureid": attributes.figureId }),
        keepOnSplit: false,
      },
    };
  },

  group: "block",

  content: "image figcaption",

  draggable: true,

  isolating: true,

  parseHTML() {
    return [
      {
        tag: `figure[data-type="${this.name}"]`,
        getAttrs: (dom) => ({
          figureId: dom.getAttribute("data-figureId") || uniqId(),
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      "figure",
      mergeAttributes(HTMLAttributes, {
        "data-type": this.name,
        id: node.attrs.figureId,
      }),
      0,
    ];
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handleDOMEvents: {
            dragstart: (view, event) => {
              if (!event.target) {
                return false;
              }

              const pos = view.posAtDOM(event.target as HTMLElement, 0);
              const $pos = view.state.doc.resolve(pos);

              if ($pos.parent.type === this.type) {
                event.preventDefault();
              }

              return false;
            },
          },
        },
      }),
      NodePasteRule({
        find: (node) => node.type.name === this.name,
        handler: ({ node }) => {
          return node.type.create(
            {
              ...node.attrs,
              figureId: uniqId(),
            },
            node.content,
            node.marks,
          );
        },
      }),
    ];
  },
});
