import type { DocumentPage } from "@/types/document-engine";
import { SectionViewport } from "@/document-engine/projection/section-viewport";
import type { DocumentResourceContext } from "@/document-engine/resources/contracts";
import { serializePDFSnapshot } from "./serialize-snapshot";
import { intersectLayoutRect } from "@/document-engine/projection/rect";
import { documentLinkTarget } from "../../../shared/document-link";

/** Capture contexts once; physical page views select placement without duplicating section DOM. */
export async function captureDocumentContexts(
  pages: readonly DocumentPage[],
  metadata: Omit<
    EditorPDFContent,
    "html" | "pages" | "fingerprint" | "presentation"
  > & { sections: EditorPDFSection[] },
  resources: DocumentResourceContext,
  appearance: string,
  signal: AbortSignal,
): Promise<EditorPDFSnapshot> {
  const root = document.createElement("main"),
    bank = document.createElement("section"),
    chrome = document.createElement("section");
  root.className = "editor-pdf-pages editor-pdf-projection";
  root.style.cssText = "position:absolute;left:-100000px;top:0";
  bank.dataset.contextBank = "";
  chrome.dataset.chromeBank = "";
  root.append(bank, chrome);
  document.body.append(root);
  const originals = new Map<HTMLElement, number>(),
    projection: EditorPDFProjection = {
      contexts: [],
      views: [],
      targets: [],
      links: [],
    };
  const frames: SectionViewport[] = [];
  const physicalPages: Map<number, number>[] = [];
  const targets = new Set<string>();
  try {
    for (const [index, page] of pages.entries()) {
      signal.throwIfAborted();
      const canonical = page.projection?.context ?? page.element;
      let context = originals.get(canonical);
      if (context === undefined) {
        context = bank.children.length;
        originals.set(canonical, context);
        physicalPages.push(new Map());
        const box = canonical.getBoundingClientRect(),
          geometry = page.projection?.geometry ?? {
            width: box.width,
            height: box.height,
            stride: box.height,
          };
        const count = page.projection?.pages ?? 1,
          holder = document.createElement("div");
        holder.dataset.printContext = String(context);
        holder.style.cssText = `position:relative;top:0;width:${geometry.width}px;height:${count * geometry.stride}px`;
        let copy: HTMLElement;
        if (page.projection) {
          const frame = new SectionViewport(canonical, geometry, count);
          frames.push(frame);
          copy = frame.context;
          holder.append(copy);
        } else {
          copy = canonical.cloneNode(true) as HTMLElement;
          Object.assign(copy.style, {
            position: "relative",
            left: "0",
            top: "0",
            margin: "0",
            transform: "none",
            zoom: "1",
          });
          holder.append(copy);
        }
        bank.append(holder);
        projection.contexts.push({
          pages: count,
          width: geometry.width,
          height: geometry.height,
          stride: geometry.stride,
        });
      }
      const localPage = page.projection?.page ?? 1;
      projection.views.push({ context, page: localPage });
      // Retain the first physical owner, matching target/destination ownership.
      if (!physicalPages[context].has(localPage))
        physicalPages[context].set(localPage, index + 1);
      const overlay = document.createElement("div");
      overlay.dataset.pageChrome = String(index);
      if (page.projection)
        for (const child of page.element.children)
          if (child !== page.content) overlay.append(child.cloneNode(true));
      chrome.append(overlay);
    }
    await resources.prepare(root);
    for (const [index, holder] of Array.from(bank.children).entries()) {
      const config = projection.contexts[index],
        origin = holder.getBoundingClientRect();
      const place = (box: Pick<DOMRect, "left" | "top">, node: Element) => {
        const y = box.top - origin.top,
          offset = Math.floor(y / config.stride) + 1;
        const page = physicalPages[index].get(offset);
        if (!page)
          throw Error(
            `Projected content has no physical page: context ${index}, local page ${offset} outside 1..${config.pages}, <${node.localName}>${node.id ? ` #${node.id}` : ""}, x=${box.left - origin.left}px, y=${y}px`,
          );
        return {
          page,
          x: box.left - origin.left,
          y: y - (offset - 1) * config.stride,
        };
      };
      for (const node of holder.querySelectorAll<HTMLElement>("[id]")) {
        if (targets.has(node.id)) continue;
        targets.add(node.id);
        projection.targets.push({
          id: node.id,
          ...place(
            node.getClientRects()[0] ?? node.getBoundingClientRect(),
            node,
          ),
        });
      }
      for (const link of holder.querySelectorAll<HTMLAnchorElement>(
        'a[href^="#"]',
      )) {
        const target = documentLinkTarget(link.getAttribute("href")!);
        if (!target) continue;
        const clip = link
          .closest(".document-template-viewport")
          ?.getBoundingClientRect();
        for (const rect of link.getClientRects()) {
          const box = clip ? intersectLayoutRect(rect, clip) : rect;
          if (!box?.width || !box.height) continue;
          projection.links.push({
            target,
            ...place(box, link),
            width: box.width,
            height: box.height,
          });
        }
      }
    }
    return await serializePDFSnapshot(
      root,
      { ...metadata, version: 3, projection },
      resources,
      appearance,
      signal,
      bank,
    );
  } finally {
    frames.forEach((frame) => frame.dispose());
    root.remove();
  }
}
