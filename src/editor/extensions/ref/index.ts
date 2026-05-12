import { Node, ReactNodeViewRenderer } from "@tiptap/react";
import { RefComponent } from "./component";
import { Plugin, PluginKey } from "@tiptap/pm/state";

export const Ref = Node.create({
  name: "refComponent",
  inline: true,
  group: "inline",
  atom: true,
  addAttributes() {
    return {
      ref: {
        renderHTML: (attrs) => ({ "data-ref": attrs.ref }),
        parseHTML: (element) => element.getAttribute("data-ref"),
      },
      link: {
        default: "",
        renderHTML: (attrs) => ({ "data-link": attrs.link }),
        parseHTML: (element) => element.getAttribute("data-link"),
      },
      label: {
        renderHTML: (attrs) => ({ "data-label": attrs.label || false }),
        parseHTML: (element) => element.getAttribute("data-label") || false,
      },
    };
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "a",
      {
        "data-ref": node.attrs.ref,
        "data-link": node.attrs.link,
        ...HTMLAttributes,
        "data-type": "ref-component",
        "data-label": node.attrs.label || false,
        href: `#${node.attrs.link}`,
        class: "ref-component",
      },
      node.attrs.label || `@${node.attrs.ref}[${node.attrs.link}]`,
    ];
  },
  parseHTML() {
    return [
      {
        tag: 'ref-component[data-type="ref-component"]',
      },
    ];
  },

  addNodeView() {
    return (props) => {
      return ReactNodeViewRenderer(RefComponent)(props);
    };
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("refPaste"),
        props: {
          handlePaste(view, _, slice) {
            const text = slice.content.textBetween(0, slice.content.size, "\n");
            const pasteRegex = /@(imageFigure|figureTable)\[([^\]]+)\]/g;
            let lastIndex = 0;
            let match;
            const { tr, schema } = view.state;

            let handled = false;

            while ((match = pasteRegex.exec(text)) !== null) {
              handled = true;

              const beforeText = text.slice(lastIndex, match.index);
              if (beforeText) {
                tr.insertText(beforeText);
              }

              const type = match[1];
              const id = match[2];

              const nodeType = schema.nodes.refComponent;
              const node = nodeType.create({
                ref: type,
                link: id,
                //   label:FigureCache.getLabel(id,type as "imageFigure") || false
              });
              tr.insert(tr.selection.from, node);
              lastIndex = pasteRegex.lastIndex;
            }

            const afterText = text.slice(lastIndex);
            if (afterText) {
              tr.insertText(afterText);
            }

            if (handled) {
              view.dispatch(tr);
            }

            return handled;
          },
        },
      }),
      //   RefPlugin,
      // attachmentSuggestion(this.editor)
    ];
  },
});
