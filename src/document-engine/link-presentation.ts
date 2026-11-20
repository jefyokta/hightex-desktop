import { documentLinkHref } from "../../shared/document-link";
import {
  formatReferenceLabel,
  isReferenceKind,
  INVALID_REFERENCE_LABEL,
} from "@/editor/extensions/ref/label";

type ReferenceElement = Pick<
  HTMLElement,
  "getAttribute" | "setAttribute" | "removeAttribute" | "textContent"
>;

/** Derived presentation only; stored href/target/labels stay untouched. */
export function referenceFallback(link: ReferenceElement) {
  const kind = link.getAttribute("data-ref") || "imageFigure";
  link.setAttribute("href", "#");
  link.setAttribute("data-status", "missing");
  link.removeAttribute("data-label");
  link.textContent = isReferenceKind(kind)
    ? formatReferenceLabel(kind, "?")
    : INVALID_REFERENCE_LABEL;
}

export function normalizeDocumentLinks(root: ParentNode) {
  for (const link of root.querySelectorAll<HTMLAnchorElement>("a[href]")) {
    if (link.getAttribute("data-type") === "ref-component") continue;
    const href = link.getAttribute("href") ?? "";
    const normalized = documentLinkHref(href);
    if (normalized === "#" && href.trim() !== "#")
      link.setAttribute("data-link-invalid", href);
    link.setAttribute("href", normalized);
  }
}
