import { uniqId } from "@/utils/uniq-id";
import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";

export const GlobalUUID = Extension.create({
  name: "globalUUID",

  addGlobalAttributes() {
    return [
      {
        types: this.extensions
          // .filter(ext =>ext.type == 'node')
          .map((e) => e.name),
        attributes: {
          uuid: {
            default: null,
            renderHTML: (attributes) => ({
              "data-uuid": attributes.uuid,
            }),
            parseHTML: (element) => element.getAttribute("data-uuid"),
          },
        },
      },
    ];
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        appendTransaction: (transactions, _oldState, newState) => {
          if (!transactions.some((tr) => tr.docChanged)) return;

          const tr = newState.tr;
          let modified = false;

          newState.doc.descendants((node, pos) => {
            if (node.attrs && "uuid" in node.attrs && !node.attrs.uuid) {
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                uuid: uniqId(),
              });
              modified = true;
            }
          });

          return modified ? tr : null;
        },
      }),
    ];
  },
});
