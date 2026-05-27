import { Engine } from "../engine";
import { Parser } from "tjsn-parser";
import { Resolver } from "./resolver";
import { AttachmentBuilder } from "../builder/attachment-builder";

export class ParserResolver implements Resolver {
  async resolve(engine: Engine) {
    const root = engine.root;
    if (!root) {
      throw new Error("ParserResolver: root not mounted");
    }
    const parser = new Parser();
    const ctx = engine.config.parser;
    if (ctx.mode === "single") {
      const chapter = ctx.chapter;
      if (!chapter) return;

      const content = (await chapter.getContent()) as any;
      root.classList.add(chapter.getHtmlClass() || "");
      if (!content) return;
      parser.render(content, root);

      return;
    }
    if (ctx.mode === "full") {
      const doc = ctx.document;
      if (!doc?.chapters) return;

      const appended: string[] = [];
      const fullContent: any[] = [];
      for (const chapter of doc.chapters.filter((c) =>
        c.query.isNormalChapter(),
      )) {
        if (appended.includes(chapter.getId())) {
          continue;
        }
        const content = (await chapter.getContent()) as any;
        //disin ada chapter 6

        fullContent.push(...content);
        appended.push(chapter.getId());
      }

      //tapi disini chapter 5 ga kerender
      parser.render(fullContent, root);
      const parent = root.parentElement!;
      const att = await AttachmentBuilder.create(engine);
      console.log(att);
      if (att) {
        parent?.append(att);
      }

      return;
    }
  }

  createWrapper() {
    return document.createElement("section");
  }
  createCover() {}
}
