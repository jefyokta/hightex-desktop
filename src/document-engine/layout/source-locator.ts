import type { Node as ModelNode } from "@tiptap/pm/model";
import type { EditorView } from "@tiptap/pm/view";
import type {
  SectionLayoutIdentity,
  SectionSourceLocator,
} from "../../../shared/section-layout";

/** Resolve source context from the immutable model, including anonymous inline positions. */
export function sectionSourceLocator(
  model: ModelNode,
  identity: Pick<SectionLayoutIdentity, "sectionId" | "sourceHash">,
  from: number,
  to = from,
): SectionSourceLocator {
  if (
    !Number.isInteger(from) ||
    !Number.isInteger(to) ||
    from < 0 ||
    to < from ||
    to > model.content.size
  )
    throw Error(`Invalid section source range: ${from}..${to}`);
  const position = model.resolve(from),
    lineage: ModelNode[] = [];
  const node = model.nodeAt(from);
  if (node && !node.isText) lineage.push(node);
  for (let depth = position.depth; depth > 0; depth--)
    lineage.push(position.node(depth));
  const nodeId = lineage.find(
    (node) => typeof node.attrs.id === "string" && node.attrs.id,
  )?.attrs.id as string | undefined;
  const figureId = lineage.find(
    (node) => typeof node.attrs.figureId === "string" && node.attrs.figureId,
  )?.attrs.figureId as string | undefined;
  const image =
    lineage.find((node) => node.type.name === "image") ??
    lineage.find((node) => node.type.name === "imageFigure")?.firstChild;
  const assetId =
    image?.type.name === "image" && typeof image.attrs.src === "string"
      ? image.attrs.src
      : undefined;
  return Object.freeze({
    chapterId: identity.sectionId,
    sourceRevision: identity.sourceHash,
    from,
    to,
    nodeId,
    figureId,
    assetId,
  });
}

/** Match resolved DOM to its actual model node; duplicate IDs never decide provenance. */
export function sectionDOMLocator(
  view: Pick<EditorView, "state" | "nodeDOM">,
  identity: Pick<SectionLayoutIdentity, "sectionId" | "sourceHash">,
) {
  const positions = new WeakMap<Node, { from: number; to: number }>();
  view.state.doc.descendants((node, from) => {
    const dom = view.nodeDOM(from);
    if (dom) positions.set(dom, { from, to: from + node.nodeSize });
  });
  return (element: Node): SectionSourceLocator | undefined => {
    for (let node: Node | null = element; node; node = node.parentNode) {
      const range = positions.get(node);
      if (range)
        return sectionSourceLocator(
          view.state.doc,
          identity,
          range.from,
          range.to,
        );
    }
  };
}
