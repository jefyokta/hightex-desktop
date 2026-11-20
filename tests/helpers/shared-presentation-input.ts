import type { JSONContent } from "@tiptap/core";
import type { DocumentRenderModel } from "../../src/types/document-snapshot";

/** Extend only the detached proof input; original editor/IDB source stays unchanged. */
export function sharedPresentationInput(content: JSONContent[], model: DocumentRenderModel) {
  const p = (text: string): JSONContent => ({ type: "paragraph", content: [{ type: "text", text }] });
  const text = "Pengujian isi cell panjang tetap mengikuti urutan sumber dan pemenggalan halaman. ";
  content.push({
    type: "imageFigure", attrs: { id: "shared-string-width", figureId: "shared-string-figure" },
    content: [{ type: "image", attrs: { src: "fixture-image", width: "240" } }, { type: "figcaption", content: [{ type: "text", text: "Gambar width string dari sumber lama" }] }],
  });
  const cell = (kind: string, text: string, attrs = {}): JSONContent => ({ type: kind, attrs, content: [p(text)] });
  content.push({
    type: "figureTable", attrs: { id: "shared-merged-table", figureId: "shared-merged-figure" },
    content: [
      { type: "figcaption", content: [{ type: "text", text: "Tabel merged dan cell panjang pada proof bersama" }] },
      { type: "table", content: [
        { type: "tableRow", content: [cell("tableHeader", "Kelompok", { rowspan: 2 }), cell("tableHeader", "Pengamatan", { colspan: 2 })] },
        { type: "tableRow", content: [cell("tableHeader", "Sumber"), cell("tableHeader", "Hasil")] },
        ...Array.from({ length: 6 }, (_, index) => ({ type: "tableRow", content: [cell("tableCell", `EQM00${index} Baris ${index}`), cell("tableCell", text.repeat(index === 2 ? 32 : 2)), cell("tableCell", text)] })),
      ] },
    ],
  });
  model.images["shared-tall-image"] = {
    mime: "image/svg+xml",
    bytes: new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="1800"><rect width="200" height="1800" fill="#cbd5e1"/></svg>'),
  };
  content.push({
    type: "imageFigure", attrs: { id: "shared-tall-target", figureId: "shared-tall-figure" },
    content: [{ type: "image", attrs: { src: "shared-tall-image", width: 400 } }, { type: "figcaption", content: [{ type: "text", text: "Gambar tinggi wajib muat satu halaman dengan caption" }] }],
  });
  content.push({ type: "paragraph", content: [{ type: "refComponent", attrs: { ref: "imageFigure", link: "shared-tall-target", label: "label-cache-tidak-dipakai" } }] });
  return content;
}
