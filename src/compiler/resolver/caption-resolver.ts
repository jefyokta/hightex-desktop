import { Engine } from "../engine";
import { Resolver } from "./resolver";

export class CaptionResolver implements Resolver {
  async resolve(engine: Engine): Promise<any> {
    const captions = Array.from(engine.root.querySelectorAll("figcaption"));

    const graphs = await this.getGraphs(engine);

    const images = graphs.flatMap((g) => g.images);
    const tables = graphs.flatMap((g) => g.tables);

    for (const caption of captions) {
      const figure = caption.closest("figure");
      if (!figure) continue;

      const id = figure.getAttribute("id");
      if (!id) continue;

      const match =
        images.find((i) => i.id === id) || tables.find((t) => t.id === id);
      if (match) {
        caption.setAttribute("data-numbering", match.numbering);
        // figure.setAttribute("data-numbering",match.numbering)
      }
    }
  }

  async getGraphs(engine: Engine) {
    const ctx = engine.config.parser;

    if (ctx.mode === "full") {
      const graphs = await Promise.all(
        ctx.document.chapters.map((c) => c.graph.sync()),
      );

      return graphs.flatMap((g) => g);
    }

    return [await ctx.chapter.graph.sync()];
  }
}
