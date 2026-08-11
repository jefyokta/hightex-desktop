import { mergeAttributes } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { Plugin } from "@tiptap/pm/state";
import {
  convertImage,
  fromClipboard,
  ImageSource,
} from "@/utils/images-to-webp";
import { ImageComponent } from "./image";
import { Document } from "@/editor/document";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    cimage: {
      insertImage: (
        src: ImageSource,
        documentId: string,
        width?: number,
      ) => ReturnType;
    };
  }
}

export const ResizableImage = Image.extend({
  name: "image",

  addAttributes() {
    return {
      src: {
        default: null as string | null,
        parseHTML: (el) =>
          (el as HTMLElement).getAttribute("data-image-id") ?? null,
        renderHTML: (attrs) =>
          attrs["src"] != null
            ? { "data-image-id": attrs["src"] as string }
            : {},
      },
      width: {
        default: 200,
        parseHTML: (el) => {
          const n = parseInt(
            (el as HTMLElement).getAttribute("width") ?? "",
            10,
          );
          return Number.isFinite(n) && n > 0 ? n : 200;
        },
        renderHTML: (attrs) => ({ width: String(attrs["width"] ?? 200) }),
      },
    };
  },

  draggable: false,
  selectable: false,

  renderHTML({ HTMLAttributes, node }) {
    return [
      "img",
      mergeAttributes(HTMLAttributes, {
        "data-image-id": node.attrs["src"] as string | null,
        width: String(node.attrs["width"] as number),
      }),
    ];
  },

  parseHTML() {
    return [
      {
        tag: "img[data-image-id]",
        getAttrs: (dom) => {
          const el = dom as HTMLImageElement;
          const id = el.getAttribute("data-image-id");
          const w = parseInt(el.getAttribute("width") ?? "", 10);
          return {
            src: id ?? null,
            width: Number.isFinite(w) && w > 0 ? w : 200,
          };
        },
      },
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageComponent);
  },

  addCommands() {
    return {
      insertImage:
        (source, documentId, width = 200) =>
        ({ commands, dispatch }) => {
          if (dispatch) {
            convertImage(source, documentId)
              .then((id: string) =>
                commands.insertContent({
                  type: "image",
                  attrs: { src: id, width },
                }),
              )
              .catch((err: unknown) => {
                console.error("[ResizableImage] insertImage failed", err);
              });
          }
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handleDOMEvents: {
            paste: (view, event: Event) => {
              const e = event as ClipboardEvent;
              const items = Array.from(e.clipboardData?.items ?? []);
              const hasImage = items.some(
                (i) => i.kind === "file" && i.type.startsWith("image/"),
              );
              if (!hasImage) return false;

              e.preventDefault();

              const documentId: string = Document.instance!.id;

              fromClipboard(e, documentId)
                .then((id) => {
                  if (id === null) return;
                  const { tr, schema } = view.state;
                  const node = schema.nodes["image"]?.create({
                    src: id,
                    width: 200,
                  });
                  if (node === undefined) return;
                  view.dispatch(tr.replaceSelectionWith(node));
                })
                .catch((err: unknown) => {
                  console.error("[ResizableImage] paste failed", err);
                });

              return true;
            },
          },
        },
      }),
    ];
  },
});

export { ResizableImage as Image };
