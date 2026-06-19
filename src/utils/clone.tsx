import { renderToStaticMarkup } from "react-dom/server";

function inlineElementStyles(el: HTMLElement) {
  const computed = window.getComputedStyle(el);

  let style = "";
  for (let i = 0; i < computed.length; i++) {
    const key = computed[i];
    const value = computed.getPropertyValue(key);
    style += `${key}:${value};`;
  }

  el.setAttribute("style", style);
}

export function inlineTree(root: HTMLElement) {
  inlineElementStyles(root);

  Array.from(root.children).forEach((child) => {
    if (child instanceof HTMLElement) {
      inlineTree(child);
    }
  });

  return root;
}

export const cloneComponentToElement = (component: React.ReactNode) => {
  const tmp = document.createElement("div");

  tmp.innerHTML = renderToStaticMarkup(component);

  const clone = tmp.cloneNode(true) as HTMLElement;

  return inlineTree(clone.firstElementChild as any);
};
