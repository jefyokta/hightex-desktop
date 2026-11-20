import { JSONContent } from "@tiptap/core";
import { HighTexDB } from "../storage/hightex-db";
import type { Chapter } from "./chapter";
import { Counter } from "tjsn-parser";

export class ChapterGraph {
  data: ChapterGraphData = {
    headings: [],
    images: [],
    tables: [],
    equations: [],
  };

  constructor(private chapter: Chapter) {}

  /** Keep document-wide equation ordering identical for live and snapshot views. */
  static numberEquations(graphs: readonly ChapterGraphData[]): EquationGraph[] {
    return graphs
      .flatMap((graph) => graph.equations)
      .map((equation, index) => ({
        ...equation,
        numbering: String(index + 1),
        pos: index + 1,
      }));
  }

  extract(content: JSONContent | JSONContent[]) {
    const result = ChapterGraph.extractFromContent({
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
    // Cached graphs may predate reordered/deleted nodes. Recount source without
    // writing authored content or mounting an editor for another chapter.
    return this.extract(await this.chapter.getContent());
  }

  /** Extract a read-only snapshot using the editor's graph rules, without storage. */
  static extractFromContent({
    content,
    chapter,
  }: {
    chapter: WalkContext["chapter"];
    content: JSONContent | JSONContent[];
  }) {
    const graph: ChapterGraphData = {
      headings: [],
      images: [],
      tables: [],
      equations: [],
    };

    const counter = {
      image: 0,
      table: 0,
      heading: {
        h1: 0,
        h2: 0,
        h3: 0,
      },
      equation: 0,
    };

    const nodes = Array.isArray(content) ? content : content?.content;

    if (!nodes) return graph;

    this.walk(nodes, { graph, counter, chapter });

    return graph;
  }
  async getHeadings() {
    return (await this.sync()).headings;
  }

  async getEquations() {
    return (await this.sync()).equations;
  }

  private static walk(nodes: JSONContent[], ctx: WalkContext, parentPath: number[] = []) {
    for (const [index, node] of nodes.entries()) {
      const path = [...parentPath, index];
      this.handleNode(node, ctx, path);

      if (node.content?.length) {
        this.walk(node.content, ctx, path);
      }
    }
  }

  private static handleNode(node: JSONContent, ctx: WalkContext, path: number[]) {
    const chapterName = ctx.chapter.getChapter();

    if (node.type === "heading") {
      // H4 is a paragraph style without indentation, not an outline level.
      if (Number(node.attrs?.level) > 3) return;
      if (!ctx.chapter.query.isAttachmentChapter() && node.attrs?.level == 1) {
        return;
      }
      this.resolveHeadingCounter(ctx.counter.heading, node.attrs?.level || 1);

      ctx.graph.headings.push({
        id: node.attrs?.id || "",
        level: node.attrs?.level || 1,
        path,
        text: node.content ?? [],
        pos: 0,
        chapterId: ctx.chapter.getId(),
        numbering: (() => {
          const { h1, h2, h3 } = ctx.counter.heading;
          const H1 = ctx.chapter.query.isAttachmentChapter()
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

    if (node.type === "blockMath") {
      ctx.counter.equation++;
      ctx.graph.equations.push({
        id: node.attrs?.id || "",
        chapterId: ctx.chapter.getId(),
        numbering: ctx.counter.equation.toString(),
        latex: node.attrs?.latex || "",
        pos: ctx.counter.equation,
        text: [],
      });
    }
  }

  private static extractCaption(node: JSONContent): JSONContent[] {
    if (!node.content) return [];

    const captionNode =
      node.type === "figureTable" ? node.content[0] : node.content[1];

    return captionNode?.content ?? [];
  }

  private static findImageSrc(node: JSONContent) {
    if (!node.content) return "";

    for (const child of node.content) {
      if (child.type === "image") {
        return child.attrs?.src || "";
      }
    }

    return "";
  }

  private static resolveHeadingCounter(
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
