import type { Node as ModelNode } from "@tiptap/pm/model";
import type { PageLayout } from "./layout";
import { LayoutSnapshot } from "./snapshot";

/** Fit indivisible visual content; never change its stored dimensions or text. */
export function fitAtomicContent(
  snapshot: LayoutSnapshot,
  node: ModelNode,
  pos: number,
  availableHeight: number,
  layout: PageLayout,
) {
  const element = snapshot.elements.get(pos);
  if (!element) return;
  if (node.type.name === "imageFigure" && node.firstChild) {
    const image = snapshot.elements.get(pos + 1);
    if (image) {
      const captionHeight = Math.max(0, element.getBoundingClientRect().height - image.getBoundingClientRect().height);
      fitAtomicContent(snapshot, node.firstChild, pos + 1, Math.max(24, availableHeight - captionHeight), layout);
      return;
    }
  }
  const bounds = element.getBoundingClientRect();
  const width = element.parentElement?.clientWidth || bounds.width;
  const factor = Math.min(1, availableHeight / Math.max(1, bounds.height), width / Math.max(1, bounds.width));
  if (factor >= 0.999) return;
  const existing = layout.scales!.find((item) => item.from === pos);
  const scale = (existing?.scale ?? 1) * factor;
  element.classList.add("editor-pagination-scaled");
  element.style.setProperty("--editor-atom-scale", String(scale));
  if (existing) existing.scale = scale;
  else layout.scales!.push({ from: pos, to: pos + node.nodeSize, scale });
}
