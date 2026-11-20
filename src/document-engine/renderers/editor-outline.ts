import type { CompiledChapter } from "../layout/chapter-compiler";
import type { EditorSection, SectionOutline } from "@/types/document-engine";
import { Counter } from "tjsn-parser";
import { outlineTitle } from "../indexes/outline-title";
import { sectionGroup } from "@/utils/section-options";

/** Source recount owns numbers; the supplied surface owns generated heading placement. */
export function editorSectionOutline(
  chapter: Pick<CompiledChapter, "headingNumbers" | "captionLabels">,
  definition: EditorSection,
  root: HTMLElement,
): SectionOutline[] {
  const outline: SectionOutline[] = [],
    group = sectionGroup(definition),
    headings = chapter.headingNumbers,
    captions = chapter.captionLabels;
  for (const heading of root.querySelectorAll<HTMLElement>(
    "h1[id],h2[id],h3[id]",
  )) {
    const level = Number(heading.tagName[1]);
    let number =
      headings.get(heading.id) ??
      (level === 1 && definition.numbering === "arabic"
        ? definition.chapter
        : "");
    if (level === 1 && definition.numbering === "appendix" && number)
      number = `Lampiran ${Counter.getAlpha(Number(number))}`;
    outline.push({
      id: heading.id,
      ...outlineTitle(heading, definition.chapter === "abstract-en"),
      number,
      level,
      kind: "heading",
      group,
    });
  }
  for (const figure of root.querySelectorAll<HTMLElement>("figure[id]")) {
    const caption = figure.querySelector("figcaption"),
      number = captions.get(figure.id);
    if (caption && number)
      outline.push({
        id: figure.id,
        ...outlineTitle(caption),
        number,
        level: 2,
        group,
        kind:
          figure.dataset.type === "imageFigure" ? "imageFigure" : "figureTable",
      });
  }
  return outline;
}
