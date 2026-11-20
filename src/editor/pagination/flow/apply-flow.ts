import {
  paginateUnits,
  recordPageBreak,
  type LayoutUnit,
  type PageLayout,
} from "./page-planner";
import type { LayoutSnapshot } from "../measurement/layout-snapshot";
import { calibratePageMargin } from "../measurement/block-margin";
import { PaginationLayoutError } from "@/exception/pagination-layout-error";
import { insertGeneratedSpacer } from "./generated-flow";

/** Plan and apply ordinary flow, including captions inside a reserved table area. */
export async function applyFlowLayout(
  snapshot: LayoutSnapshot,
  layout: PageLayout,
  units: LayoutUnit[],
  checkpoint: () => Promise<void>,
  reservedTop = 0,
) {
  if (!units.length) return;
  let result: PageLayout;
  try {
    result = paginateUnits(units, snapshot.geometry, reservedTop);
  } catch (error) {
    throw new PaginationLayoutError(error, {
      from: units.reduce(
        (from, unit) => Math.min(from, unit.from),
        units[0].from,
      ),
      to: units.reduce(
        (to, unit) => Math.max(to, unit.to ?? unit.from),
        units[0].from,
      ),
    });
  }
  for (const [index, item] of result.breaks.entries()) {
    if (item.slot) {
      const movement = result.decisions?.[index];
      if (!movement || movement.kind !== "break")
        throw Error("Missing generated block decision");
      const block = snapshot.generated.get(item.slot)!;
      const calibrated =
        item.offset !== undefined
          ? { height: item.height, marginTop: 0 }
          : calibratePageMargin(block, item.height);
      if (item.offset !== undefined)
        insertGeneratedSpacer(block, item.offset, item.height);
      (layout.generated ??= []).push({
        slot: item.slot,
        offset: item.offset,
        ...calibrated,
        reasons: [...movement.reasons],
        movement: {
          fromPage: movement.fromPage,
          toPage: movement.toPage,
          beforeTop: movement.beforeTop,
          beforeBottom: movement.beforeBottom,
          limit: movement.limit,
          targetTop: movement.targetTop,
          displacement: movement.displacement,
        },
      });
      continue;
    }
    if (item.kind === "block")
      Object.assign(item, snapshot.margin(item.from, item.height));
    else snapshot.spacer(item.from, item.height);
    recordPageBreak(layout, item);
  }
  (layout.decisions ??= []).push(
    ...(result.decisions ?? []).filter(
      (item) => item.kind !== "break" || !item.slot,
    ),
  );
  layout.pages = Math.max(layout.pages, result.pages);
  await checkpoint();
}
