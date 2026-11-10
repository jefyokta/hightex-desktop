import { CommandProps, ReactNodeViewRenderer } from "@tiptap/react";
import { ImageFigure as ImageFigureComponent } from "./component";
import { Figure } from "../figure";
import { createFigureImage } from "@/editor/utils/create-figure-image";

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
          return editor.commands.insertContent(createFigureImage(imgUrl));
        },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageFigureComponent);
  },
});
