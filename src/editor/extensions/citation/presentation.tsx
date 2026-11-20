import { forwardRef, type HTMLAttributes } from "react";

export type CitationStatus = "loading" | "ready" | "error";
export const citationClassName =
  "cursor-pointer rounded px-0.5 text-neutral-700 hover:bg-yellow-200 dark:text-neutral-300 dark:hover:bg-yellow-900/40";

export const CitationPresentation = forwardRef<
  HTMLElement,
  HTMLAttributes<HTMLElement> & {
    text: string;
    status: CitationStatus;
  }
>(({ text, status, ...attributes }, ref) => (
  <cite
    ref={ref}
    {...attributes}
    data-citation-status={status}
    className={citationClassName}
  >
    {text}
  </cite>
));

export function presentCitation(
  element: HTMLElement,
  text: string,
  status: CitationStatus,
) {
  element.className = citationClassName;
  element.dataset.citationStatus = status;
  element.textContent = text;
}
