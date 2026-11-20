import { mergeAttributes } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import { chapterContentNodeView } from "@/editor/chapter/content-node-view";
import { Plugin } from "@tiptap/pm/state";
import {
  convertImage,
  fromClipboard,
  ImageSource,
} from "@/utils/images-to-webp";
import { ImageComponent } from "./image";
import { Document } from "@/editor/document";
import { DEFAULT_IMAGE_WIDTH, imageWidth } from "./size";
import { MISSING_IMAGE_SOURCE } from "./fallback";

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
        default: DEFAULT_IMAGE_WIDTH,
        parseHTML: (el) => imageWidth(el.getAttribute("width")),
        renderHTML: (attrs) => ({ width: String(imageWidth(attrs["width"])) }),
      },
    };
  },

  draggable: false,
  selectable: false,

  renderHTML({ HTMLAttributes, node }) {
    return [
      "div",
      { class: "node-image relative group flex", id: node.attrs.id },
      [
        "img",
        mergeAttributes(HTMLAttributes, {
          id: null,
          "data-image-id": node.attrs["src"] as string | null,
          width: String(imageWidth(node.attrs["width"])),
          class: "h-auto",
          src: MISSING_IMAGE_SOURCE,
          alt: "Gambar tidak tersedia",
        }),
      ],
    ];
  },

  parseHTML() {
    return [
      {
        tag: "img[data-image-id]",
        getAttrs: (dom) => {
          const el = dom as HTMLImageElement;
          const id = el.getAttribute("data-image-id");
          return {
            src: id ?? null,
            width: imageWidth(el.getAttribute("width")),
          };
        },
      },
    ];
  },

  addNodeView() {
    return chapterContentNodeView(ImageComponent);
  },

  addCommands() {
    return {
      insertImage:
        (source, documentId, width = DEFAULT_IMAGE_WIDTH) =>
        ({ commands, dispatch }) => {
          if (dispatch) {
            convertImage(source, documentId)
              .then((id: string) =>
                commands.insertContent({
                  type: "image",
                  attrs: { src: id, width: imageWidth(width) },
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
                    width: DEFAULT_IMAGE_WIDTH,
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
