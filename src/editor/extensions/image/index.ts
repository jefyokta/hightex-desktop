import { mergeAttributes } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { ImageComponent } from "./image";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    cimage: {
      deleteImage: () => ReturnType;
    };
  }
}
const ResizableImage = Image.extend({
  name: "image",

  addAttributes() {
    return {
      src: { default: null },
      width: { default: "200px" },
      height: { default: "auto" },
    };
  },
  draggable: false,
  selectable: false,

  parseHTML() {
    return [
      {
        tag: "img",
        getAttrs: (dom) => {
          const element = dom as HTMLImageElement;
          return {
            src: element.getAttribute("src"),
            width: element.getAttribute("width") || "200px",
            height: element.style.height || "auto",
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      "img",
      mergeAttributes(HTMLAttributes, {
        style: `cursor: nwse-resize;`,
        width: node.attrs.width,
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageComponent);
  },
  addCommands(): Partial<any> {
    return {
      deleteImage: () => {
        // const {$anchor} = this.editor.state.selection
        // const node = $anchor.nodeAfter || $anchor.parent
        return true;
      },
    };
  },
});

export { ResizableImage as Image };
