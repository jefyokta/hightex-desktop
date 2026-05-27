import { JSONContent } from "@tiptap/core";
import { HighTexDB } from "../storage/hightex-db";
import { Chapter } from "./chapter";
import { Counter } from "tjsn-parser";

export class ChapterGraph {
  data: ChapterGraphData = {
    headings: [],
    images: [],
    tables: [],
  };

  constructor(private chapter: Chapter) {}

  extract(content: JSONContent | JSONContent[]) {
    const result = this.extractFromContent({
      content,
      chapter: this.chapter,
    });

    this.data = result;

    return result;
  }

  async sync() {
    const content = await this.chapter.getContent();

    const data = this.extract(content);

    await HighTexDB.getInstance().chapterGraphs.put({
      id: this.chapter.getId(),
      data,
    });

    return data;
  }

  async syncSingle(content: JSONContent | JSONContent[]) {
    const data = this.extract(content);

    await HighTexDB.getInstance().chapterGraphs.put({
      id: this.chapter.getId(),
      data,
    });

    return data;
  }

  async warm() {
    const stored = await HighTexDB.getInstance().chapterGraphs.get(
      this.chapter.getId(),
    );

    if (stored?.data) {
      this.data = stored.data;
      return this.data;
    }

    return await this.sync();
  }

  private extractFromContent({
    content,
    chapter,
  }: {
    chapter: Chapter;
    content: JSONContent | JSONContent[];
  }) {
    const graph: ChapterGraphData = {
      headings: [],
      images: [],
      tables: [],
    };

    const counter = {
      image: 0,
      table: 0,
      heading: {
        h1: 0,
        h2: 0,
        h3: 0,
      },
    };

    const nodes = Array.isArray(content) ? content : content?.content;

    if (!nodes) return graph;

    this.walk(nodes, { graph, counter, chapter });

    return graph;
  }
  async getHeadings() {
    return (await this.sync()).headings;
  }

  private walk(nodes: JSONContent[], ctx: WalkContext) {
    for (const node of nodes) {
      this.handleNode(node, ctx);

      if (node.content?.length) {
        this.walk(node.content, ctx);
      }
    }
  }

  private handleNode(node: JSONContent, ctx: WalkContext) {
    const chapterName = ctx.chapter.getChapter();

    if (node.type === "heading") {
      if (!ctx.chapter.query.isAttachmentChapter() && node.attrs?.level == 1) {
        return;
      }
      this.resolveHeadingCounter(ctx.counter.heading, node.attrs?.level || 1);

      ctx.graph.headings.push({
        id: node.attrs?.id || "",
        level: node.attrs?.level || 1,
        text: node.content ?? [],
        pos: 0,
        chapterId: ctx.chapter.getId(),
        numbering: (() => {
          const { h1, h2, h3 } = ctx.counter.heading;
          let H1 = ctx.chapter.query.isAttachmentChapter()
            ? h1
            : ctx.chapter.getChapter();

          if (node.attrs?.level === 1) return `${H1}`;
          if (node.attrs?.level === 2) return `${H1}.${h2}`;
          if (node.attrs?.level === 3) return `${H1}.${h2}.${h3}`;

          return `${h1}`;
        })(),
      });
    }

    if (node.type === "imageFigure") {
      ctx.counter.image++;

      ctx.graph.images.push({
        id: node.attrs?.id || "",
        imgSrc: this.findImageSrc(node),
        pos: ctx.counter.image,
        text: this.extractCaption(node),
        numbering: !ctx.chapter.query.isAttachmentChapter()
          ? `${chapterName}.${ctx.counter.image}`
          : `${Counter.getAlpha(ctx.counter.heading.h1)}.${ctx.counter.image}`,
        chapterId: ctx.chapter.getId(),
      });
    }

    if (node.type === "figureTable") {
      ctx.counter.table++;

      ctx.graph.tables.push({
        id: node.attrs?.id || "",
        pos: ctx.counter.table,
        text: this.extractCaption(node),
        numbering: !ctx.chapter.query.isAttachmentChapter()
          ? `${chapterName}.${ctx.counter.table}`
          : `${Counter.getAlpha(ctx.counter.heading.h1)}.${ctx.counter.table}`,
        chapterId: ctx.chapter.getId(),
      });
    }
  }

  private extractCaption(node: JSONContent): JSONContent[] {
    if (!node.content) return [];

    const captionNode =
      node.type === "figureTable" ? node.content[0] : node.content[1];

    return captionNode?.content ?? [];
  }

  private findImageSrc(node: JSONContent) {
    if (!node.content) return "";

    for (const child of node.content) {
      if (child.type === "image") {
        return child.attrs?.src || "";
      }
    }

    return "";
  }

  private resolveHeadingCounter(
    h: WalkContext["counter"]["heading"],
    level: number,
  ) {
    if (level === 1) {
      h.h1++;
      h.h2 = 0;
      h.h3 = 0;
      return;
    }

    if (level === 2) {
      h.h2++;
      h.h3 = 0;
      return;
    }

    if (level === 3) {
      h.h3++;
    }
  }
}
