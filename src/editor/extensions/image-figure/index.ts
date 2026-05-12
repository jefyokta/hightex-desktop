import { CommandProps, ReactNodeViewRenderer } from "@tiptap/react";
import { ImageFigure as ImageFigureComponent } from "./component";
import { Figure } from "../figure";
import { uniqId } from "@/utils/uniq-id";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    figureImage: {
      addFigureImage: (imgUrl: string) => boolean;
    };
  }
}
export const ImageFigure = Figure.extend({
  name: "imageFigure",
  content: "image figcaption",
  draggable: true,
  addCommands: (): any => {
    return {
      addFigureImage:
        (imgUrl: string) =>
        ({ editor }: CommandProps) => {
          return editor.commands.insertContent({
            type: "imageFigure",
            attrs: {
              figureId: uniqId(),
            },
            content: [
              {
                type: "image",
                attrs: {
                  src: imgUrl,
                },
              },
              {
                type: "figcaption",
                text: "Image Caption",
              },
            ],
          });
        },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageFigureComponent);
  },
});
