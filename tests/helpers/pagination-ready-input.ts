import type { JSONContent } from "@tiptap/core";
import { complexTableInput } from "./complex-table-input";

export function paginationReadyInput(variant: string): JSONContent[] {
  const paragraph = (text: string): JSONContent => ({ type: "paragraph", content: [{ type: "text", text }] });
  const tail: JSONContent[] = [{ type: "orderedList", attrs: { start: 7 }, content: [
    { type: "listItem", content: [paragraph("Urutan tujuh " + "Isi daftar tetap lengkap. ".repeat(15)), {
      type: "orderedList", attrs: { start: 3 }, content: [{ type: "listItem", content: [paragraph("Urutan c.")] }],
    }] },
    { type: "listItem", content: [paragraph("Urutan delapan.")] },
  ] }];
  if (variant !== "one-pixel") return [...complexTableInput(variant === "nested" ? "adjacent-nested" : "merged"), ...tail];
  return [{ type: "figureTable", content: [
    { type: "figcaption", content: [{ type: "text", text: "Kolom satu piksel berisi teks" }] },
    { type: "table", content: Array.from({ length: 30 }, (_, row) => ({ type: "tableRow", content: [
      { type: row ? "tableCell" : "tableHeader", attrs: { colwidth: [1] }, content: [
        { type: "heading", attrs: { level: 4 }, content: [{ type: "text", text: "i" }] },
      ] },
      { type: row ? "tableCell" : "tableHeader", attrs: { colwidth: [200] }, content: [paragraph("Baris pengujian " + row)] },
    ] })) },
  ] }, ...tail];
}
