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
import { CustomTableRow, TableCell, TableHeader } from "../extensions/table";
import { FigureTable } from "../extensions/figure-table";
import { MathBlock, MathInline } from "../extensions/math";
import { NodeShortcut } from "../extensions/node-shortcut";
import { Table, TableKit } from "@tiptap/extension-table";
import { Grid, GridCell, GridRow } from "../extensions/grid";
import { CustomCodeBlock } from "../extensions/code-block";
import { Dots } from "../extensions/dots";
import { Variable } from "../extensions/variable";

export class ChapterExtensions {
  constructor(private chapter: Chapter) {}

  get() {
    const isNonChapter = [
      "abstract",
      "abstract-en",
      "presentation",
      "foreword",
    ].includes(this.chapter.getChapter());

    if (isNonChapter) {
      return this.getNonChapter();
    }

    return [
      StarterKit.configure({
        heading: false,
        listItem: false,
        paragraph: false,
        codeBlock: false,
      }),

      Heading.configure({
        levels: [1, 2, 3, 4],
      }),
      ...(this.chapter.query.isNormalChapter()
        ? [
            ForceHeading.configure({
              title: this.chapter.title,
              marks: [],
            }),
          ]
        : []),
      ListItem,
      Paragraph,
      Cite,
      Image,
      ImageFigure,
      FigureCaption,
      Ref,
      FigureTable,
      CustomTableRow,
      TableCell,
      TableHeader,
      TableKit.configure({
        tableCell: false,
        tableHeader: false,
        tableRow: false,
        table: false,
      }),
      Table.extend({
        isolating: true,
      }).configure({ resizable: true }),
      MathInline,
      MathBlock,
      NodeShortcut,
      Grid,
      GridCell,
      GridRow,
      CustomCodeBlock,
      Dots,
      Variable,
    ];
  }

  private getNonChapter() {
    return [StarterKit, Variable];
  }
}
