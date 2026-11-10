import type { JSONContent } from "@tiptap/core";
import { uniqId } from "@/utils/uniq-id";

export function createFigureImage(
  src: string | null = null,
  caption = "Image Caption",
): JSONContent {
  return {
    type: "imageFigure",
    attrs: { figureId: uniqId() },
    content: [
      { type: "image", attrs: { src: src || null } },
      {
        type: "figcaption",
        content: [{ type: "text", text: caption }],
      },
    ],
  };
}
