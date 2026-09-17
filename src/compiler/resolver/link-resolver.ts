import { Counter } from "tjsn-parser";
import { Engine } from "../engine";
import { Resolver } from "./resolver";

export class LinkResolver implements Resolver {
  async resolve(engine: Engine) {
    const root = engine.root;
    const doc =
      engine.parser.mode == "single"
        ? engine.parser.chapter.document
        : engine.parser.document;
    if (!doc.ready) {
      await doc.warm();
    }
    const anchors = root.querySelectorAll<HTMLAnchorElement>("a");

    for (const a of Array.from(anchors)) {
      const id = a.getAttribute("href")?.slice(1);
      if (!id) continue;

      if (a.classList.contains("imagefigure")) {
        const img = (await doc.getImages()).find((i) => i.id === id);
        if (img) a.textContent = `Gambar ${img.numbering}`;
      }

      if (a.classList.contains("figuretable")) {
        const table = (await doc.getTables()).find((t) => t.id === id);

        if (table) a.textContent = `Tabel ${table.numbering}`;
      }

      if(a.classList.contains("head")){
        const head = (await doc.getHeadings()).filter(h=>h.chapterId=== doc.id+".attachment").find((t: any) => t.id === id);

        if (head) a.textContent = `Lampiran ${Counter.getAlpha(Number(head.numbering))}`;

      }
      if(a.classList.contains("equation")){
        const eq = (await doc.getEquations()).find(e=>e.id ==id)
        if(eq) a.textContent =`Persamaan ${eq.numbering}`
      }
    }
  }
}
