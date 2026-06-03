import { Engine } from "../engine";
import { Parser } from "tjsn-parser";
import { Resolver } from "./resolver";
import { AttachmentBuilder } from "../builder/attachment-builder";
import { HighTexDB } from "@/editor/storage/hightex-db";
import { ImageQueue } from "../queues/image-queue";

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
      await this.resolveImages(root);
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

        fullContent.push(...content);
        appended.push(chapter.getId());
      }

      parser.render(fullContent, root);
      const parent = root.parentElement!;
      const att = await AttachmentBuilder.create(engine);
      if (att) {
        parent?.append(att);
      }
      await this.resolveImages(root);

      return;
    }
  }

  createWrapper() {
    return document.createElement("section");
  }
  async resolveImages(root: HTMLElement) {
    const imgs = Array.from(root.querySelectorAll("img"));

    for (const img of imgs) {
      if (img.src.startsWith("data:image/")) {
        console.warn("image still using base64");
        continue;
      }
      const n = img.src.split("/");
      const s = n[n.length - 1];

      const blob = await HighTexDB.getInstance().getBlob(s);
      if (blob) {
        const src = URL.createObjectURL(blob);
        ImageQueue.objectUrls.push(src);

        img.src = src;
      }
    }
  }
}
