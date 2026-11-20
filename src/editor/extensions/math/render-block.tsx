import { renderToStaticMarkup } from "react-dom/server";
import { MathBlockPresentation } from "./presentation";

export function renderMathBlock(element: HTMLElement, number?: number | null) {
  const html = element.innerHTML;
  element.classList.add("my-4");
  element.innerHTML = renderToStaticMarkup(
    <MathBlockPresentation html={html} number={number} />,
  );
}
