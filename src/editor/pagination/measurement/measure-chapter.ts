import type { EditorView } from "@tiptap/pm/view";
import type { Node as ModelNode } from "@tiptap/pm/model";
import { textFlow, collectFlow, flowUnits, FlowCache } from "../flow/text-flow";
import { type LayoutUnit, type PageLayout } from "../flow/page-planner";
import { LayoutSnapshot, layoutCheckpoint } from "./layout-snapshot";
import { paginateTable } from "../tables/paginate-table";
import { fitAtomicContent } from "./fit-content";
import { DEFAULT_PAGINATION, type PaginationGeometry } from "../options";
import { paginationNode } from "./node-layout";
import type { SectionComposition } from "@/document-engine/composition/section-composition";
import { applyFlowLayout } from "../flow/apply-flow";
import { generatedFlow } from "../flow/generated-flow";
import { PaginationLayoutError } from "@/exception/pagination-layout-error";

/** A bounded, cancellable layout pass over a snapshot of one editor document. */
export async function measureEditor(
  view: EditorView,
  cache: FlowCache,
  signal: AbortSignal,
  geometry: PaginationGeometry = DEFAULT_PAGINATION,
  composition?: SectionComposition,
): Promise<PageLayout | null> {
  if (!view.dom.isConnected || !view.dom.getBoundingClientRect().width)
    return null;
  const snapshot = new LayoutSnapshot(view, geometry, composition);
  const checkpoint = layoutCheckpoint(signal);
  const layout: PageLayout = {
    breaks: [],
    pages: 1,
    rows: [],
    scales: [],
    furniture: [],
  };
  const { contentHeight } = geometry;
  try {
    const first = snapshot.model.firstChild;
    if (
      composition?.definition.headingAnchor &&
      first?.type.name === "heading" &&
      first.attrs.level === 1 &&
      !first.attrs.id
    )
      layout.anchors = [
        {
          from: 0,
          to: first.nodeSize,
          id: composition.definition.headingAnchor,
        },
      ];
    const atoms: { node: ModelNode; pos: number }[] = [];
    snapshot.model.descendants((node, pos) => {
      const kind = paginationNode(node, pos)?.kind;
      if (node.isBlock && (kind === "atomic" || kind === "image-figure")) {
        atoms.push({ node, pos });
        return false;
      }
      return true;
    });
    for (const { node, pos } of atoms) {
      try {
        await fitAtomicContent(
          snapshot,
          node,
          pos,
          contentHeight,
          layout,
          cache,
          checkpoint,
        );
      } catch (error) {
        signal.throwIfAborted();
        throw new PaginationLayoutError(error, {
          from: pos,
          to: pos + node.nodeSize,
        });
      }
    }
    let pending: LayoutUnit[] = [];
    pending.push(...(await generatedFlow(snapshot, true, checkpoint)));
    const flush = async () => {
      await applyFlowLayout(snapshot, layout, pending, checkpoint);
      pending = [];
    };
    const visit = async (
      node: ModelNode,
      pos: number,
      listItem?: { node: ModelNode; pos: number },
    ) => {
      await checkpoint();
      const element = snapshot.elements.get(pos);
      if (!element || snapshot.completedTables.has(pos)) return;
      try {
        const target = paginationNode(node, pos);
        if (target?.kind === "table") {
          await paginateTable(
            snapshot,
            target.node,
            target.position,
            layout,
            cache,
            checkpoint,
            { leading: pending },
          );
          pending = [];
        } else if (target?.kind === "image-figure") {
          pending.push(
            ...flowUnits(
              await collectFlow(snapshot, node, pos, cache, checkpoint),
            ),
          );
        } else if (target?.kind === "atomic") {
          const bounds = element.getBoundingClientRect();
          pending.push({
            from: pos,
            to: pos + node.nodeSize,
            top: bounds.top - snapshot.origin,
            bottom: bounds.bottom - snapshot.origin,
            kind: "block",
            breakBefore: node.type.name === "horizontalRule",
            marginTop: parseFloat(getComputedStyle(element).marginTop) || 0,
          });
        } else if (node.isTextblock) {
          const lines = await textFlow(snapshot, node, pos, cache, checkpoint);
          if (listItem && lines.length) {
            const item = snapshot.elements.get(listItem.pos)!;
            lines[0].anchor = {
              from: listItem.pos,
              to: listItem.pos + listItem.node.nodeSize,
              top: item.getBoundingClientRect().top - snapshot.origin,
              marginTop: parseFloat(getComputedStyle(item).marginTop) || 0,
            };
          }
          // Headings keep their chain; figure image/caption flow supplies its own anchor.
          pending.push(...flowUnits(lines, node.type.name === "heading"));
        } else {
          let offset = 0;
          for (let index = 0; index < node.childCount; index++) {
            const child = node.child(index);
            await visit(
              child,
              pos + 1 + offset,
              index === 0 && node.type.name === "listItem"
                ? { node, pos }
                : undefined,
            );
            offset += child.nodeSize;
          }
        }
      } catch (error) {
        signal.throwIfAborted();
        if (error instanceof PaginationLayoutError) throw error;
        throw new PaginationLayoutError(error, {
          from: pos,
          to: pos + node.nodeSize,
        });
      }
    };
    let pos = 0;
    for (const node of snapshot.model.content.content) {
      await visit(node, pos);
      pos += node.nodeSize;
    }
    pending.push(...(await generatedFlow(snapshot, false, checkpoint)));
    await flush();
    signal.throwIfAborted();
    return layout;
  } finally {
    snapshot.destroy();
  }
}
