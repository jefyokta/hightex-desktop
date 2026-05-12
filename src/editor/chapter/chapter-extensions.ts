import StarterKit from "@tiptap/starter-kit";

import { Heading } from "../extensions/heading";
import { ForceHeading } from "../extensions/force-heading";
import { ListItem } from "../extensions/list-item";

import { Chapter } from "./chapter";
import { Paragraph } from "../extensions/paragraph";
import { Cite } from "../extensions/citation";
import { Image } from "../extensions/image";
import { ImageFigure } from "../extensions/image-figure";
import { FigureCaption } from "../extensions/figure-caption";
import { Ref } from "../extensions/ref";

export class ChapterExtensions {
  constructor(private chapter: Chapter) {}

  get() {
    const isNonChapter = ["abstract", "abstract-en"].includes(
      this.chapter.getChapter(),
    );

    if (isNonChapter) {
      return this.getNonChapter();
    }

    return [
      StarterKit.configure({
        heading: false,
        listItem: false,
        paragraph: false,
      }),

      Heading.configure({
        levels: [1, 2, 3, 4],
      }),

      ForceHeading.configure({
        title: this.chapter.title,
        marks: [],
      }),
      ListItem,
      Paragraph,
      Cite,
      Image,
      ImageFigure,
      FigureCaption,
      Ref,
    ];
  }

  private getNonChapter() {
    return [];
  }
}
