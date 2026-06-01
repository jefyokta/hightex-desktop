import { Engine } from "../engine";
import { Counter, Parser } from "tjsn-parser";

export class AttachmentBuilder {
  private static createWrapper() {
    const section = document.createElement("section");
    section.classList.add("attachment");

    return section;
  }

  static async create(engine: Engine) {
    const chapter = this.getChapter(engine);
    if (!chapter) return;

    const parser = new Parser();

    const content = await chapter.getContent();
    const wrapper = this.createWrapper();
    parser.render(content as any, wrapper);
    const h1 = document.createElement("div");
    h1.style.display = "none";
    h1.textContent = "LAMPIRAN";
    h1.style.breakBefore = "never";
    h1.style.height = "0";
    h1.id = "attachment";
    wrapper.insertBefore(h1, wrapper.firstChild);
    const { headings, images, tables } = await chapter.graph.sync();

    wrapper.querySelectorAll("h1").forEach(async (h) => {
      const graph = headings.find((h1) => h.id == h1.id);
      if (!graph) return;
      h.setAttribute(
        "data-numbering",
        Counter.getAlpha(Number(graph.numbering)),
      );
    });
    wrapper.querySelectorAll("figure[data-type='imageFigure']").forEach((h) => {
      const graph = images.find((img) => h.id == img.id);
      if (!graph) return;
      const captionNode = h.querySelector("figcaption");
      if (!captionNode) return;
      const nums = graph.numbering.split(".");
      nums[0] = this.getLastH1Numbering(h);

      captionNode.setAttribute("data-numbering", nums.join("."));
    });
    wrapper.querySelectorAll("figure[data-type='figureTable']").forEach((h) => {
      const graph = tables.find((tab) => h.id == tab.id);
      if (!graph) return;
      const captionNode = h.querySelector("figcaption");
      if (!captionNode) return;
      const nums = graph.numbering.split(".");
      nums[0] = this.getLastH1Numbering(h);

      captionNode.setAttribute("data-numbering", nums.join("."));
    });
    wrapper.querySelectorAll("figure").forEach((f) => f.removeAttribute("id"));

    return wrapper;
  }

  static getChapter(engine: Engine) {
    if (engine.config.parser.mode == "single") {
      const tmp = engine.config.parser.chapter;
      if (tmp.getChapter().toLowerCase() !== "attachment") {
        return undefined;
      }
      return tmp;
    }
    if (engine.parser.mode == "full") {
      const doc = engine.parser.document;
      return doc.chapters.find(
        (c) => c.getChapter().toLowerCase() == "attachment",
      );
    }

    return undefined;
  }
  static findPreviousH1(el: Element) {
    let current: Element | null = el;

    while (current) {
      let prev = current.previousElementSibling;
      console.log("looping....");

      while (prev) {
        if (prev.matches("h1")) {
          return prev;
        }

        const nested = prev.querySelector("h1:last-of-type");
        if (nested) {
          return nested;
        }

        prev = prev.previousElementSibling;
      }

      current = current.parentElement;
    }

    return null;
  }

  static getLastH1Numbering(el: Element) {
    return this.findPreviousH1(el)?.getAttribute("data-numbering") || "";
  }
}
