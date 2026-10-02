import { Engine } from "../engine";
import { formatInTextCitation } from "@/utils/citation";
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
        const ids = id?.split("|") || [];
        const bibs = (await Promise.all(ids.map((i) => db.cite.get(i)))).filter(
          (cite): cite is CiteRecord => cite !== undefined,
        );
        if (!bibs.length) return;
        for (const rec of bibs) {
          CitationResolver.used[rec.key] = rec.bib;
        }
        const isAuthor = a.hasAttribute("citeA");
        const { inText } = formatInTextCitation(bibs, isAuthor);
        a.textContent = inText;
      }),
    );

    const bib = new BibliographyBuilder().create();

    // root.parentElement?.append(bib)
    root.parentElement?.insertBefore(bib, root.nextElementSibling);
  }
}
