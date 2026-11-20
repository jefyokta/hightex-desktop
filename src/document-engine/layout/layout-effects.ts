import type { PageLayout } from "@/editor/pagination/flow/page-planner";
import type { SectionLayoutEffects } from "../../../shared/section-layout";

/** Publish the existing planner's calibrated effects, without carrying its mutable builder. */
export function sectionLayoutEffects(plan: PageLayout): SectionLayoutEffects {
  if (plan.error) throw Error("Cannot publish failed layout effects");
  return {
    anchors: plan.anchors?.map(({ from, to, id }) => ({ from, to, id })),
    breaks: plan.breaks.map(({ from, to, kind, height, marginTop }) => ({
      from,
      to,
      kind,
      height,
      marginTop,
    })),
    rows: plan.rows?.map(({ from, to, height }) => ({ from, to, height })),
    scales: plan.scales?.map(({ from, to, scale }) => ({ from, to, scale })),
    furniture: plan.furniture?.map(({ top, left, width, html }) => ({
      top,
      left,
      width,
      html,
    })),
    generated: plan.generated?.map((item) => ({
      ...item,
      reasons: [...item.reasons],
      movement: { ...item.movement },
    })),
  };
}
