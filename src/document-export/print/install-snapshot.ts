import { abortable } from "@/utils/abortable";
import { waitForPrintImages } from "@/compiler/print-resources";
import { sha256Text } from "@/utils/sha256";
import {
  editorPDFIdentity,
  validateEditorPDFSnapshot,
} from "../../../shared/editor-pdf-contract";
import { waitForContentFonts } from "../../document-engine/resources/fonts";
import { installPageViewport } from "./page-viewport";
import {
  documentLinkHref,
  documentLinkTarget,
} from "../../../shared/document-link";

/** Paint a portable captured page set. This host has no editor or page planner. */
export async function installPDFSnapshot(
  target: HTMLElement,
  input: EditorPDFSnapshot,
  signal: AbortSignal,
): Promise<() => void> {
  validateEditorPDFSnapshot(input);
  const hash = await sha256Text(editorPDFIdentity(input));
  if (hash !== input.fingerprint)
    throw Error(
      `Editor PDF snapshot identity changed: fingerprint ${input.fingerprint} does not match content hash ${hash}`,
    );
  signal.throwIfAborted();
  const parsed = new DOMParser().parseFromString(input.html, "text/html");
  // The host accepts inert editor markup, including new schema tags. Keep
  // executable/embedded content out of the privileged print window.
  const forbidden = parsed.querySelector(
    "script,iframe,object,embed,link,base,meta,template",
  );
  if (forbidden)
    throw Error(
      `Unsupported editor PDF markup: <${forbidden.localName}> is not allowed in captured content`,
    );
  for (const node of parsed.querySelectorAll("*")) {
    for (const attr of node.attributes) {
      if (attr.name.startsWith("on") || attr.name === "srcdoc")
        throw Error(
          `Unsupported editor PDF attribute ${attr.name} on ${nodeName(node)}`,
        );
      if (attr.name === "src" && !attr.value.startsWith("data:image/"))
        throw Error(
          `Editor PDF image is not portable: ${nodeName(node)} src must contain embedded data:image/ bytes`,
        );
      if (attr.name === "href")
        node.setAttribute("href", documentLinkHref(attr.value));
    }
  }
  const root = parsed.body.querySelector(".editor-pdf-pages");
  if (!root) throw Error("Editor PDF markup is missing .editor-pdf-pages");
  if (parsed.body.children.length !== 1)
    throw Error(
      `Editor PDF body must contain one page root; found ${parsed.body.children.length} elements`,
    );
  const destinations = new Set(
    Array.from(root.querySelectorAll("[id]"), (node) => node.id),
  );
  for (const link of root.querySelectorAll('a[href^="#"]')) {
    const destination = documentLinkTarget(link.getAttribute("href")!);
    if (!destination || !destinations.has(destination))
      link.setAttribute("href", "#");
  }
  if (!root.classList.contains("editor-pdf-projection"))
    throw Error("Editor PDF markup is missing .editor-pdf-projection on the page root");
  const styles = Array.from(
    parsed.head.querySelectorAll("style"),
    (style) => style.cloneNode(true) as HTMLStyleElement,
  );
  const dispose = () => {
    styles.forEach((style) => style.remove());
    target.replaceChildren();
  };
  try {
    document
      .querySelectorAll('style,link[rel="stylesheet"]')
      .forEach((node) => node.remove());
    document.documentElement.className = parsed.documentElement.className;
    styles.forEach((style) => document.head.append(style));
    target.replaceChildren(document.importNode(root, true));
    await waitForPrintImages(target, signal);
    target.getBoundingClientRect();
    await abortable(document.fonts.ready, signal);
    signal.throwIfAborted();
    await waitForContentFonts(target, signal);
    const releaseProjection = installPageViewport(target.firstElementChild as HTMLElement, input);
    return () => {
      releaseProjection();
      dispose();
    };
  } catch (error) {
    dispose();
    throw error;
  }
}

function nodeName(node: Element) {
  const owner = node.closest("[id]");
  return `<${node.localName}>${owner ? ` in #${owner.id}` : ""}`;
}
