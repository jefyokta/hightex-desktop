import type { SectionOutline } from "@/types/document-engine";
import { editorNonContentSelector } from "@/editor/pagination/presentation/decorations";

/** Index titles retain italic and resolved math, without authored formatting marks. */
export function outlineTitle(element: HTMLElement, italic = false): Pick<SectionOutline, "text" | "titleHTML"> {
  const copy = element.cloneNode(true) as HTMLElement;
  copy.querySelectorAll(editorNonContentSelector + ",.katex-mathml").forEach(node => node.remove());
  for (const node of Array.from(copy.querySelectorAll<HTMLElement>("*")).reverse()) {
    if (node.closest(".katex")) continue; // Math layout belongs to its renderer.
    if (node.matches("br")) continue;
    if (node.matches("em,i") || node.style.fontStyle === "italic") {
      const emphasis = element.ownerDocument.createElement("em");
      emphasis.append(...node.childNodes);
      node.replaceWith(emphasis);
    } else node.replaceWith(...node.childNodes);
  }
  copy.querySelectorAll("[id]").forEach(node => node.removeAttribute("id"));
  if (italic || element.ownerDocument.defaultView?.getComputedStyle(element).fontStyle === "italic") {
    const emphasis = element.ownerDocument.createElement("em");
    emphasis.append(...copy.childNodes);
    copy.append(emphasis);
  }
  return { text: copy.textContent?.trim() ?? "", titleHTML: copy.innerHTML.trim() };
}
