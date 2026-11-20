import type { Node as ModelNode } from "@tiptap/pm/model";
import type { SectionLayoutResult } from "../../../shared/section-layout";
import { paginationDecorations } from "./presentation/decorations";

/** Consume one published result without measuring, dispatching transactions or rebuilding state. */
export function sectionResultDecorations(
  current: ModelNode,
  captured: ModelNode,
  result: Readonly<SectionLayoutResult>,
) {
  if (
    !current.eq(captured) ||
    current.content.size !== result.sourceSize
  )
    throw Error(
      "Cannot apply section layout to a different source revision",
    );
  const nodeRange = (from: number, to: number, row = false) => {
    const node = current.nodeAt(from);
    if (
      !node ||
      node.isText ||
      from + node.nodeSize !== to ||
      (row && node.type.spec.tableRole !== "row")
    )
      throw Error(
        `Layout effect does not identify its source node: ${from}..${to}`,
      );
  };
  for (const item of result.effects.breaks)
    if (item.kind === "block") nodeRange(item.from, item.to!);
  for (const item of result.effects.rows ?? [])
    nodeRange(item.from, item.to, true);
  for (const item of result.effects.scales ?? []) nodeRange(item.from, item.to);
  for (const item of result.effects.anchors ?? []) {
    nodeRange(item.from, item.to);
    const node = current.nodeAt(item.from)!;
    if (node.attrs.id && node.attrs.id !== item.id)
      throw Error("A derived anchor cannot replace an authored source ID");
  }
  return paginationDecorations(current, result.effects);
}
