import { formatPageNumber } from "@/utils/page-number";
import { sectionGroup } from "@/utils/section-options";
import { Counter } from "tjsn-parser";
import type { DocumentSectionSlot, PageSection } from "@/types/document-engine";
import { pageTargets } from "./page-content";

/** Document offsets and labels never change a section's internal page breaks. */
export function numberDocument(sections: readonly DocumentSectionSlot[]) {
  const metadata: PageSection[] = [],
    targets = new Map<string, string>();
  let physical = 1,
    roman = 1,
    arabic = 1,
    appendix = 0,
    appendixPage = 0;
  for (const { definition, rendered } of sections) {
    if (!rendered && !(definition.kind === "template" && definition.index))
      throw Error(`Content section has not been rendered: ${definition.id}`);
    // An unmeasured index starts with one provisional page. Subsequent passes
    // use its actual page count, without rendering a throwaway placeholder.
    const pages = rendered?.pages.length ?? 1;
    const section: PageSection = {
      id: definition.id,
      firstPage: physical,
      pages,
      labels: [],
    };
    const format =
      definition.options?.pageNumber?.format ??
      (sectionGroup(definition) === "introduction" ? "roman-lower" : "decimal");
    for (let index = 0; index < pages; index++) {
      const page = rendered?.pages[index];
      let label = "";
      switch (definition.numbering) {
        case "roman":
          label = formatPageNumber(roman++, format);
          break;
        case "arabic":
          label = formatPageNumber(arabic++, format);
          break;
        case "appendix":
          if (
            page &&
            pageTargets(page).some((node) => node.matches("h1[id]"))
          ) {
            appendix++;
            appendixPage = 0;
          }
          label = `${Counter.getAlpha(Math.max(1, appendix))} - ${formatPageNumber(++appendixPage, format)}`;
          break;
        case "none":
          if (definition.id === "cover") roman++;
          break;
      }
      section.labels.push(label);
      const documentPage = physical++;
      if (!page) continue;
      page.element.dataset.documentSection = definition.id;
      page.element.dataset.documentGroup = sectionGroup(definition);
      page.element.dataset.documentPage = String(documentPage);
      page.element.dataset.pageLabel = label;
      for (const node of pageTargets(page)) {
        if (!targets.has(node.id)) targets.set(node.id, label);
      }
    }
    metadata.push(section);
  }
  return { metadata, targets };
}
