import type { JSONContent } from "@tiptap/core";
export { columnResizingPluginKey } from "@tiptap/pm/tables";
export { DOMParser as ModelDOMParser } from "@tiptap/pm/model";

const paragraph = (text: string): JSONContent => ({ type: "paragraph", content: text ? [{ type: "text", text }] : [] });
const table = (widths: (number | null)[], emptyFirst = false): JSONContent => ({
  type: "table",
  content: Array.from({ length: 4 }, (_, row) => ({ type: "tableRow", content: widths.map((width, column) => ({
    type: row ? "tableCell" : "tableHeader",
    attrs: { colwidth: width === null ? null : [width] },
    content: [paragraph(emptyFirst && !column ? "" : `Data ${row} kolom ${column}`)],
  })) })),
});
const figure = (grid: JSONContent): JSONContent => ({ type: "figureTable", content: [{ type: "figcaption", content: [{ type: "text", text: "Column sizing" }] }, grid] });

export function tableWidthInput(variant: string): JSONContent[] {
  if (variant === "fixed") return [figure(table([120, 160, 180]))];
  if (variant === "automatic") return [figure(table([null, null, null]))];
  if (variant === "one-pixel") return [figure(table([1, 200, 200], true))];
  if (variant === "oversize") return [figure(table([400, 400, 400]))];
  const outer = table([240, 240]);
  outer.content![1].content![0].content!.push(figure(table([300, 300])));
  return [figure(outer)];
}
