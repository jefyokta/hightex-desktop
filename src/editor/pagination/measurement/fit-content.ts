import type { Node as ModelNode } from "@tiptap/pm/model";
import type { PageLayout } from "../flow/page-planner";
import { LayoutSnapshot } from "./layout-snapshot";
import { paginationScaleAttributes } from "../presentation/decorations";
import { imageWidth } from "../../extensions/image/size";
import { textFlow, type FlowCache } from "../flow/text-flow";
import { captionImageHeight } from "./figure-caption";

/** Fit indivisible visual content; never change its stored dimensions or text. */
export async function fitAtomicContent(
  snapshot: LayoutSnapshot,
  node: ModelNode,
  pos: number,
  availableHeight: number,
  layout: PageLayout,
  cache: FlowCache,
  checkpoint: () => Promise<void>,
) {
  const element = snapshot.elements.get(pos);
  if (!element) return;
  if (node.type.name === "imageFigure" && node.firstChild) {
    const image = snapshot.elements.get(pos + 1);
    if (image) {
      const caption = node.maybeChild(1),
        captionPos = pos + 1 + node.firstChild.nodeSize;
      const captionElement = snapshot.elements.get(captionPos);
      const lines =
        caption && captionElement
          ? await textFlow(snapshot, caption, captionPos, cache, checkpoint)
          : [];
      const bounds = element.getBoundingClientRect(),
        imageBounds = image.getBoundingClientRect();
      const captionBounds = captionElement?.getBoundingClientRect();
      const insets = Math.max(
        0,
        bounds.height - imageBounds.height - (captionBounds?.height ?? 0),
      );
      const height = captionBounds
        ? captionImageHeight(
            availableHeight,
            insets,
            {
              top: captionBounds.top - snapshot.origin,
              bottom: captionBounds.bottom - snapshot.origin,
            },
            lines,
          )
        : Math.max(1, availableHeight - insets);
      await fitAtomicContent(
        snapshot,
        node.firstChild,
        pos + 1,
        height,
        layout,
        cache,
        checkpoint,
      );
      return;
    }
  }
  const bounds = element.getBoundingClientRect();
  const width = element.parentElement?.clientWidth || bounds.width;
  const existing = layout.scales!.find((item) => item.from === pos);
  let scale: number;
  if (node.type.name === "image") {
    const intrinsic = snapshot.images.get(pos);
    const authoredWidth = imageWidth(node.attrs.width);
    if (!intrinsic) throw Error("Image dimensions are not ready");
    scale = Math.min(
      1,
      width / authoredWidth,
      (availableHeight * intrinsic.width) / intrinsic.height / authoredWidth,
    );
  } else {
    const factor = Math.min(
      1,
      availableHeight / Math.max(1, bounds.height),
      width / Math.max(1, bounds.width),
    );
    if (factor >= 0.999) return;
    scale = (existing?.scale ?? 1) * factor;
  }
  if (scale >= 1 && !existing) return;
  const attributes = paginationScaleAttributes(node, scale);
  element.classList.add(attributes.class);
  element.style.cssText += `;${attributes.style}`;
  if (existing) existing.scale = scale;
  else layout.scales!.push({ from: pos, to: pos + node.nodeSize, scale });
  (layout.decisions ??= []).push({
    kind: "fit",
    from: pos,
    to: pos + node.nodeSize,
    scale,
    availableHeight,
  });
}
