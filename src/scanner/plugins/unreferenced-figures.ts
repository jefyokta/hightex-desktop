import { walk } from "../context";
import { definePlugin } from "./types";

const REF_TO_KIND = {
  imageFigure: "images",
  figureTable: "tables",
  equation: "equations",
} as const;

export const unreferencedFigures = definePlugin({
  id: "unreferenced-figures",
  label: "Checking figure references",

  async run(ctx) {
    const referred = {
      images: new Set<string>(),
      tables: new Set<string>(),
      equations: new Set<string>(),
    };

    for (const [, content] of Object.entries(ctx.contents)) {
      walk(content, ({ type, attrs }) => {
        if (type !== "refComponent" || !attrs?.link) return;
        const kind = REF_TO_KIND[attrs.ref as keyof typeof REF_TO_KIND];
        if (kind) referred[kind].add(attrs.link);
      });
    }

    const { images, tables, equations } = ctx;

    return {
      images: images.filter((x) => !referred.images.has(x.id)),
      tables: tables.filter((x) => !referred.tables.has(x.id)),
      equations: equations.filter((x) => !referred.equations.has(x.id)),
    };
  },
});
