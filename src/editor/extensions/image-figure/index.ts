import { chapterContentNodeView } from "@/editor/chapter/content-node-view";
import { ImageFigure as ImageFigureComponent } from "./component";
import { Figure } from "../figure";
import { createFigureImage } from "@/editor/utils/create-figure-image";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    figureImage: {
      addFigureImage: (imgUrl: string) => ReturnType;
    };
  }
}
export const ImageFigure = Figure.extend({
  name: "imageFigure",
  content: "image figcaption",
  extendNodeSchema(extension) {
    return extension.name === "imageFigure"
      ? { editorPagination: { kind: "image-figure" } }
      : {};
  },
  draggable: true,
  addCommands() {
    return {
      addFigureImage:
        (imgUrl: string) =>
        ({ commands }) => {
          return commands.insertContent(createFigureImage(imgUrl));
        },
    };
  },
  addNodeView() {
    return chapterContentNodeView(ImageFigureComponent);
  },
});
