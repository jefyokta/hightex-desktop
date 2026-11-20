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
import {
  CustomTableRow,
  TableCell,
  TableHeader,
  Table,
} from "../extensions/table";
import { FigureTable } from "../extensions/figure-table";
import { MathBlock, MathInline } from "../extensions/math";
import { NodeShortcut } from "../extensions/node-shortcut";
import { SearchReplace } from "../extensions/search-replace";
import { CustomCodeBlock } from "../extensions/code-block";
import { Dots } from "../extensions/dots";
import { Variable } from "../extensions/variable";
import { TableBorder } from "../extensions/table/border";
import { Placeholder } from "@tiptap/extensions";
import { createAliasPlugin } from "../plugins/alias-hint-plugin";
import { Extension, generateHTML, type JSONContent } from "@tiptap/core";
import { Comment } from "../extensions/comment";
import { Note } from "../extensions/note";
import { assertSupportedContent } from "@/utils/document-content";
import { NodeIdentity } from "../extensions/uuid/identity-extension";

type ChapterExtensionContext = Pick<
  Chapter,
  "frozen" | "title" | "getChapter"
> & {
  query: Pick<Chapter["query"], "isNormalChapter">;
};

export class ChapterExtensions {
  constructor(private chapter: ChapterExtensionContext) {}
  public placeHolder: Record<string, string> = {
    "abstract-en": "200 words maximum",
    abstract: "Maksimal 200 kata",
    presentation: "Maksimal 1 halam",
    foreword: "Maksimal 2 halaman",
  };
  static contentSchema(chapterName: string) {
    return new ChapterExtensions({
      frozen: false,
      title: "",
      getChapter: () => chapterName,
      query: { isNormalChapter: () => false },
    }).get(false);
  }
  /**
   * Serialize using the editor schema, without creating an editor or plugins.
   * Node-view content (images, math, references, citations) still needs its
   * resolved rendering context; this is not a paginated PDF export.
   */
  static serializeContent(chapterName: string, nodes: JSONContent[]): string {
    assertSupportedContent(nodes);
    const extensions = this.contentSchema(chapterName);
    return generateHTML({ type: "doc", content: nodes }, extensions);
  }
  get(enableAliasHint = false) {
    if (this.chapter.frozen) return [];
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
        blockquote: false,
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
      // TableKit.configure({
      //   tableCell: false,
      //   tableHeader: false,
      //   tableRow: false,
      //   table: false,

      // }),
      Table.extend({
        // isolating: true,
      }).configure({ resizable: true }),

      MathInline,
      MathBlock,
      NodeShortcut,
      TableBorder,
      CustomCodeBlock,
      Dots,
      Variable,
      SearchReplace,
      ...(enableAliasHint
        ? [
            Extension.create({
              name: "plugin-stuff",
              addProseMirrorPlugins() {
                return [createAliasPlugin()];
              },
            }),
          ]
        : []),
      Comment,
      Note,
      NodeIdentity,
    ];
  }

  private getNonChapter() {
    const hasPlaceholder = this.placeHolder[this.chapter.getChapter()];
    return [
      StarterKit.configure({ blockquote: false }),
      Variable,
      SearchReplace,
      Note,
      NodeIdentity,
      ...(hasPlaceholder
        ? [Placeholder.configure({ placeholder: hasPlaceholder })]
        : []),
    ];
  }
}
