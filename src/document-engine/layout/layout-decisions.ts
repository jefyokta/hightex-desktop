import type { Node as ModelNode } from "@tiptap/pm/model";
import type {
  SectionLayoutDecision,
  SectionLayoutIdentity,
} from "../../../shared/section-layout";
import type { LayoutDecision } from "@/editor/pagination/flow/page-planner";
import { sectionSourceLocator } from "./source-locator";

/** Attach revision-bound source context; never infer a reason from final DOM geometry. */
export function sectionLayoutDecisions(
  model: ModelNode,
  identity: SectionLayoutIdentity,
  decisions: readonly LayoutDecision[],
): SectionLayoutDecision[] {
  const locate = (range: { from: number; to?: number }) =>
    sectionSourceLocator(model, identity, range.from, range.to);
  return decisions.map((decision) => {
    const source = locate(decision);
    if (decision.kind === "break")
      return {
        kind: decision.kind,
        source,
        placement: decision.placement,
        trigger: locate(decision.trigger),
        container: decision.container ? locate(decision.container) : undefined,
        reasons: [...decision.reasons],
        fromPage: decision.fromPage,
        toPage: decision.toPage,
        beforeTop: decision.beforeTop,
        beforeBottom: decision.beforeBottom,
        limit: decision.limit,
        targetTop: decision.targetTop,
        displacement: decision.displacement,
      };
    if (decision.kind === "fit")
      return {
        kind: decision.kind,
        source,
        scale: decision.scale,
        availableHeight: decision.availableHeight,
      };
    return {
      kind: decision.kind,
      source,
      page: decision.page,
      x: decision.x,
      y: decision.y,
      width: decision.width,
      height: decision.height,
    };
  });
}
