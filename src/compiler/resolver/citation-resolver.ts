import { Engine } from "../engine";
import { CiteUtils } from "bibtex.js";
import { formatManual } from "@/utils/citation";
import { Resolver } from "./resolver";
import { BibliographyBuilder } from "../builder/bibliography-builder";

export class CitationResolver implements Resolver {
  static readonly used: Record<string, string> = {};
  async resolve(engine: Engine) {
    const root = engine.root;
    const db = engine.db;

    const nodes = root.querySelectorAll<HTMLAnchorElement>("a[data-cite]");

    await Promise.all(
      Array.from(nodes).map(async (a) => {
        const id = a.getAttribute("href")?.slice(1);
        if (!id) return;

        const bib = (await db.cite.get(id))?.bib;
        if (!bib) return;

        const cu = new CiteUtils(bib);
        CitationResolver.used[id] = bib;

        const isAuthor = a.hasAttribute("citeA");
        const manual = a.getAttribute("data-manual") === "1";

        const text = a.getAttribute("data-text") || "";
        const year = a.getAttribute("data-year") || "";

        a.textContent = manual
          ? formatManual(text, year, isAuthor)
          : isAuthor
            ? cu.toCiteA()
            : cu.toCite();
      }),
    );

    const bib = new BibliographyBuilder().create();

    // root.parentElement?.append(bib)
    root.parentElement?.insertBefore(bib, root.nextElementSibling);
  }
}
