import { assertEditorPDFPresentation } from "../snapshot/presentation";

/** Move one canonical context into the fixed print viewport. No editor or measurement decisions. */
export function installPageViewport(
  root: HTMLElement,
  snapshot: EditorPDFSnapshot,
) {
  const bank = root.querySelector<HTMLElement>("[data-context-bank]"),
    chrome = root.querySelector<HTMLElement>("[data-chrome-bank]");
  if (!bank) throw Error("Editor PDF markup: missing [data-context-bank]");
  if (!chrome) throw Error("Editor PDF markup: missing [data-chrome-bank]");
  if (bank.children.length !== snapshot.projection.contexts.length)
    throw Error(
      `Editor PDF contexts: expected ${snapshot.projection.contexts.length}, found ${bank.children.length}`,
    );
  if (chrome.children.length !== snapshot.pages)
    throw Error(
      `Editor PDF page chrome: expected ${snapshot.pages} entries, found ${chrome.children.length}`,
    );
  const contexts = Array.from(bank.children) as HTMLElement[],
    overlays = Array.from(chrome.children) as HTMLElement[];
  contexts.forEach((context, index) => {
    if (context.dataset.printContext !== String(index))
      throw Error(
        `Editor PDF contexts[${index}]: expected data-print-context="${index}", found ${JSON.stringify(context.dataset.printContext)}`,
      );
  });
  overlays.forEach((overlay, index) => {
    if (overlay.dataset.pageChrome !== String(index))
      throw Error(
        `Editor PDF page chrome[${index}]: expected data-page-chrome="${index}", found ${JSON.stringify(overlay.dataset.pageChrome)}`,
      );
  });
  const viewport = document.createElement("div"),
    style = document.createElement("style");
  viewport.dataset.printViewport = "";
  root.append(viewport);
  bank.style.cssText = chrome.style.cssText =
    "position:absolute;left:-100000px;top:0";
  style.textContent = `html,body {margin:0!important;padding:0!important;background:white!important}
    [data-print-viewport]{position:relative;overflow:hidden;margin:0;padding:0;font:12pt/1.5 "Times New Roman",serif;background:white;color:black}
    [data-print-viewport] *{break-before:auto!important;break-after:auto!important;break-inside:auto!important;orphans:1!important;widows:1!important}
    @media print{[data-context-bank],[data-chrome-bank],[data-editor-pdf-debug-controls]{display:none!important}}
  `;
  document.head.append(style);
  let disposed = false;
  let selected: number | undefined;
  let selectedCount = 0;
  const select = (index: number, fingerprint: string, count = 1) => {
    if (disposed) throw Error("Editor PDF viewport is disposed");
    if (fingerprint !== snapshot.fingerprint)
      throw Error(
        "Editor PDF viewport fingerprint does not match the installed snapshot",
      );
    if (!Number.isInteger(index) || index < 0 || index >= snapshot.pages ||
        !Number.isInteger(count) || count < 1 || index + count > snapshot.pages)
      throw Error(
        `Editor PDF viewport selection index=${index}, count=${count} is outside 0..${snapshot.pages - 1}`,
      );
    const view = snapshot.projection.views[index],
      geometry = snapshot.projection.contexts[view.context];
    for (let offset = 1; offset < count; offset++) {
      const next = snapshot.projection.views[index + offset];
      if (next.context !== view.context || next.page !== view.page + offset)
        throw Error(`Editor PDF viewport batch crosses a canonical context at page ${index + offset + 1}`);
    }
    if (selected !== undefined) {
      const previous = contexts[snapshot.projection.views[selected].context];
      previous.style.top = "0px";
      bank.append(previous);
      for (const overlay of overlays.slice(selected, selected + selectedCount)) {
        overlay.removeAttribute("style");
        chrome.append(overlay);
      }
    }
    const height = (count - 1) * geometry.stride + geometry.height;
    style.textContent =
      style.textContent.replace(/@page\s*\{[^}]*\}/g, "") +
      `\n@page{size:${geometry.width}px ${height}px;margin:0}`;
    viewport.style.width = `${geometry.width}px`;
    viewport.style.height = `${height}px`;
    contexts[view.context].style.top =
      `${-(view.page - 1) * geometry.stride}px`;
    const chromePages = overlays.slice(index, index + count);
    if (count > 1)
      chromePages.forEach((overlay, offset) => {
        overlay.style.cssText = `position:absolute;left:0;top:${offset * geometry.stride}px;width:${geometry.width}px;height:${geometry.height}px`;
      });
    viewport.replaceChildren(contexts[view.context], ...chromePages);
    viewport.dataset.physicalPage = String(index + 1);
    selected = index;
    selectedCount = count;
  };
  const api = Object.freeze({ select });
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    if (window.editorPDFViewport === api) delete window.editorPDFViewport;
    style.remove();
    viewport.remove();
  };
  window.editorPDFViewport = api;
  // Resources and captured geometry are checked once at installation. Page selection
  // only moves the already-owned context; it does not re-audit the whole document.
  try {
    assertEditorPDFPresentation(bank, snapshot.presentation);
    select(0, snapshot.fingerprint);
    return dispose;
  } catch (error) {
    dispose();
    throw error;
  }
}
