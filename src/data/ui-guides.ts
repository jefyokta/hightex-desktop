import release120 from "./ui-guides/releases/1.2.0";
import release130 from "./ui-guides/releases/1.3.0";
import release140 from "./ui-guides/releases/1.4.0";
import { versionAtLeast } from "./ui-guides/version";
export { versionAtLeast } from "./ui-guides/version";

// Register release definitions here. Runtime eligibility and ordering are automatic.
export const GUIDE_RELEASES: GuideRelease[] = [
  release120,
  release130,
  release140,
];

export function availableReleases(
  currentVersion: string,
  catalog: GuideRelease[] = GUIDE_RELEASES,
): GuideRelease[] {
  return catalog
    .filter((release) => versionAtLeast(currentVersion, release.version))
    .sort((a, b) => {
      if (
        versionAtLeast(a.version, b.version) &&
        versionAtLeast(b.version, a.version)
      )
        return 0;
      return versionAtLeast(a.version, b.version) ? -1 : 1;
    });
}

export function availableGuides(
  version: string,
  scope: GuideScope,
  catalog: GuideRelease[] = GUIDE_RELEASES,
  workspaceType?: "local" | "cloud",
): AvailableGuide[] {
  return availableReleases(version, catalog).flatMap(({ version, guides }) =>
    guides
      .filter(
        (guide) =>
          guide.scope === scope &&
          guide.steps.length > 0 &&
          (!workspaceType ||
            !guide.workspaceType ||
            guide.workspaceType === workspaceType),
      )
      .map((guide) => ({ ...guide, version })),
  );
}

export function guidePlan(
  status: OnboardingStatus,
  scope: GuideScope,
  replay = false,
  catalog: GuideRelease[] = GUIDE_RELEASES,
  workspaceType?: "local" | "cloud",
): GuidePlan | null {
  // Workspace setup takes priority over automatic feature tours.
  if (!replay && scope === "workspace" && status.profileSetupPending) return null;
  const guides = availableGuides(
    status.currentVersion,
    scope,
    catalog,
    workspaceType,
  ).filter(
    (guide) => replay || (status.seenGuides[guide.id] ?? 0) < guide.revision,
  );
  if (!guides.length) return null;
  const firstUse =
    status.firstInstalled ||
    (status.installedVersion !== null &&
      Object.keys(status.seenGuides).length === 0);
  if (firstUse && !replay) {
    const versions = [...new Set(guides.map((guide) => guide.version))];
    guides.sort(
      (a, b) =>
        versions.indexOf(a.version) - versions.indexOf(b.version) ||
        (a.welcomeOrder ?? Number.MAX_SAFE_INTEGER) -
          (b.welcomeOrder ?? Number.MAX_SAFE_INTEGER),
    );
  }
  return { mode: replay ? "replay" : firstUse ? "welcome" : "updates", guides };
}

// Automatic skip dismisses all offered features. Manual replay only marks visited ones.
export function guideAcknowledgments(
  plan: GuidePlan,
  visited: ReadonlySet<string> = new Set(),
): GuideAcknowledgment[] {
  return plan.guides
    .filter((guide) => plan.mode !== "replay" || visited.has(guide.id))
    .map(({ id, revision }) => ({ id, revision }));
}
