import { renderToStaticMarkup } from "react-dom/server";
import { AbbreviationRow } from "../../src/components/editor/non-tiptap-editor/abbreviation-row";
import { bibliographyContent } from "../../src/compiler/builder/bibliography-content";
import { DocumentIndex } from "../../src/document-engine/indexes/document-index";
import type { TemplateSection } from "../../src/types/document-engine";
import { outlineTitle } from "../../src/document-engine/indexes/outline-title";

export function templateFlowInput(variant: string): TemplateSection {
  const section: TemplateSection = { id: variant, title: `Generated ${variant}`, kind: "template", numbering: "roman", html: "" };
  if (variant === "index" || variant === "tall-index") {
    section.index = "toc";
    const index = new DocumentIndex(), count = variant === "index" ? 100 : 1;
    index.collect(Array.from({ length: count }, (_, i) => {
      const title=document.createElement('h1');title.textContent=variant === "tall-index"
      ? `JUDUL-AWAL ${"Judul panjang untuk daftar isi yang harus lengkap. ".repeat(170)} JUDUL-AKHIR`
      : `Bab ${i} ${"Daftar pengujian. ".repeat(3)}`;
      return { id: `target-${i}`, ...outlineTitle(title), group:'content' as const, number: String(i + 1), level: 1, kind: "heading" as const };
    }));
    section.html = index.html(section, new Map(Array.from({ length: count }, (_, i) => [`target-${i}`, String(i + 1)])));
  } else if (variant === "bibliography") section.html = bibliographyContent([
    `@book{long,title={${"Referensi panjang dengan seluruh judul tetap utuh. ".repeat(180)}},author={Aria Writer},year={2026}}`,
    "@book{tail,title={BIBLIOGRAPHY-END},author={Budi Writer},year={2026}}",
  ]).outerHTML;
  else {
    section.options = { margins: { left: 50, right: 50 } };
    section.html = "<h1>DAFTAR SINGKATAN</h1>" + Array.from({ length: 24 }, (_, i) => renderToStaticMarkup(
      <AbbreviationRow item={{ key: `SINGKATAN-${i}`, value: `Keterangan ${"yang harus tetap utuh. ".repeat(8)}` }} standalone />,
    )).join("");
  }
  return section;
}
