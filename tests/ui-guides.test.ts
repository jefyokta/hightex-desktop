import { expect, test } from "bun:test";
import {
  availableReleases,
  availableGuides,
  guidePlan,
  guideAcknowledgments,
  versionAtLeast,
  GUIDE_RELEASES,
} from "../src/data/ui-guides";

const step = (id: string): GuideStep => ({
  id,
  title: "guide.steps.documents.title",
  description: "guide.steps.documents.description",
  selectors: [`[data-tour="${id}"]`],
  route: "/dashboard",
});
const feature: UIGuide = {
  id: "new-feature",
  revision: 1,
  scope: "workspace",
  name: "guide.features.documents.name",
  summary: "guide.features.documents.summary",
  steps: [step("one"), step("two")],
};
const release: GuideRelease = { version: "1.3.0", guides: [feature] };
const status = (
  overrides: Partial<OnboardingStatus> = {},
): OnboardingStatus => ({
  time: "2026-01-01T00:00:00.000Z",
  firstInstalled: false,
  installedVersion: "1.1.0",
  currentVersion: "1.3.0",
  previousVersion: "1.1.0",
  versionChanged: true,
  seenGuides: {},
  ...overrides,
});
const baselineReleases = availableReleases("1.2.0");
const baseline = availableGuides("1.2.0", "workspace");
const seenBaseline = Object.fromEntries(
  baseline.map((guide) => [guide.id, guide.revision]),
);

test("planned 1.3.0 guides appear on upgrade without repeating seen 1.2.0 features", () => {
  const seenOldGuides = Object.fromEntries(
    GUIDE_RELEASES.filter(({ version }) => version === "1.2.0")
      .flatMap(({ guides }) => guides)
      .map(({ id, revision }) => [id, revision]),
  );
  for (const currentVersion of ["1.2.1", "1.3.0-beta.1"]) {
    expect(
      guidePlan(
        status({ currentVersion, seenGuides: seenOldGuides }),
        "workspace",
      ),
    ).toBeNull();
    expect(
      guidePlan(
        status({ currentVersion, seenGuides: seenOldGuides }),
        "editor",
      ),
    ).toBeNull();
  }
  const upgrade = status({ seenGuides: seenOldGuides });
  const workspace = guidePlan(upgrade, "workspace")!;
  expect(workspace.mode).toBe("updates");
  expect(workspace.guides.map(({ id }) => id)).toEqual([
    "form-generation",
    "lecturer-directory",
  ]);
  const editor = guidePlan(upgrade, "editor")!;
  expect(editor.guides.map(({ id }) => id)).toEqual([
    "document-author-profile",
  ]);
  const acknowledged = {
    ...upgrade,
    seenGuides: {
      ...seenOldGuides,
      ...Object.fromEntries(
        guideAcknowledgments(workspace).map(({ id, revision }) => [
          id,
          revision,
        ]),
      ),
    },
  };
  expect(guidePlan(acknowledged, "workspace")).toBeNull();
  expect(guidePlan(acknowledged, "editor")?.guides.map(({ id }) => id)).toEqual(
    ["document-author-profile"],
  );
});

test("new users learn local defaults before forms while upgrades and replay retain release order", () => {
  const welcome = guidePlan(status({ firstInstalled: true }), "workspace")!;
  expect(
    welcome.guides
      .filter((guide) => guide.version === "1.3.0")
      .map((guide) => guide.id),
  ).toEqual(["lecturer-directory", "form-generation"]);
  expect(
    welcome.guides.slice(2).every((guide) => guide.version === "1.2.0"),
  ).toBe(true);
  const replay = guidePlan(
    status({ firstInstalled: true }),
    "workspace",
    true,
  )!;
  expect(replay.guides.slice(0, 2).map((guide) => guide.id)).toEqual([
    "form-generation",
    "lecturer-directory",
  ]);
});

test("new installation offers named features with the current release first", () => {
  const plan = guidePlan(status({ firstInstalled: true }), "workspace", false, [
    ...baselineReleases,
    release,
  ]);
  expect(plan?.mode).toBe("welcome");
  expect(plan?.guides.map((guide) => guide.version)).toEqual([
    "1.3.0",
    ...Array(4).fill("1.2.0"),
  ]);
  expect(plan?.guides[0].name).toBe(feature.name);
  expect(plan?.guides[0].steps.map((step) => step.id)).toEqual(["one", "two"]);
  expect(guideAcknowledgments(plan!)).toEqual([
    { id: feature.id, revision: 1 },
    ...baseline.map(({ id, revision }) => ({ id, revision })),
  ]);
});

test("eligibility uses version, while read state uses guide ID and revision", () => {
  expect(
    guidePlan(status({ currentVersion: "1.1.9" }), "workspace", false, [
      release,
    ]),
  ).toBeNull();
  expect(
    guidePlan(
      status({ seenGuides: { "new-feature": 1 } }),
      "workspace",
      false,
      [release],
    ),
  ).toBeNull();
  expect(
    guidePlan(
      status({ currentVersion: "1.3.0", seenGuides: { "new-feature": 1 } }),
      "workspace",
      false,
      [release],
    ),
  ).toBeNull();
  // A new guide in an already installed version is still offered.
  expect(
    guidePlan(
      status({
        currentVersion: "1.3.0",
        previousVersion: "1.3.0",
        versionChanged: false,
      }),
      "workspace",
      false,
      [release],
    )?.guides[0].id,
  ).toBe("new-feature");
  expect(guidePlan(status(), "workspace", false, [])).toBeNull();
});

test("a revised guide returns once; older revisions never replace newer seen state", () => {
  const revised = { ...release, guides: [{ ...feature, revision: 2 }] };
  expect(
    guidePlan(
      status({ seenGuides: { "new-feature": 1 } }),
      "workspace",
      false,
      [revised],
    )?.guides,
  ).toHaveLength(1);
  expect(
    guidePlan(
      status({ seenGuides: { "new-feature": 3 } }),
      "workspace",
      false,
      [revised],
    ),
  ).toBeNull();
});

test("automatic skip acknowledges every unseen feature, including missed releases", () => {
  const next = {
    version: "1.4.0",
    guides: [{ ...feature, id: "next-feature" }],
  };
  const plan = guidePlan(
    status({ currentVersion: "1.4.0", seenGuides: seenBaseline }),
    "workspace",
    false,
    [...baselineReleases, release, next],
  )!;
  expect(plan.mode).toBe("updates");
  expect(plan.guides.map((guide) => guide.id)).toEqual([
    "next-feature",
    "new-feature",
  ]);
  expect(guideAcknowledgments(plan, new Set(["next-feature"]))).toEqual([
    { id: "next-feature", revision: 1 },
    { id: "new-feature", revision: 1 },
  ]);
  const seen = Object.fromEntries(
    guideAcknowledgments(plan).map(({ id, revision }) => [id, revision]),
  );
  expect(
    guidePlan(
      status({ currentVersion: "1.4.0", seenGuides: seen }),
      "workspace",
      false,
      [release, next],
    ),
  ).toBeNull();
});

test("replay shows seen features but acknowledges only features actually opened", () => {
  const plan = guidePlan(
    status({ seenGuides: { "new-feature": 1 } }),
    "workspace",
    true,
    [...baselineReleases, release],
  )!;
  expect(plan.mode).toBe("replay");
  expect(plan.guides[0].version).toBe("1.3.0");
  expect(guideAcknowledgments(plan)).toEqual([]); // Closing the picker marks nothing.
  expect(guideAcknowledgments(plan, new Set(["references"]))).toEqual([
    { id: "references", revision: 2 },
  ]);
  expect(guideAcknowledgments(plan, new Set(["missing"]))).toEqual([]);
});

test("release order is semantic and independent of registration order, with no future releases", () => {
  const catalog = ["1.2.0", "2.0.0", "1.9.0", "1.10.0", "1.1.2"].map(
    (version) => ({ ...release, version }),
  );
  expect(
    availableReleases("1.10.0", catalog).map((release) => release.version),
  ).toEqual(["1.10.0", "1.9.0", "1.2.0", "1.1.2"]);
  expect(
    availableReleases("1.10.1", catalog).map((release) => release.version),
  ).toEqual(["1.10.0", "1.9.0", "1.2.0", "1.1.2"]);
  expect(availableReleases("1.1.1")).toEqual([]);
});

test.each([
  ["1.10.0", "1.2.0", true],
  ["1.2.0", "1.10.0", false],
  ["1.2.0", "1.2.0", true],
  ["v1.2.0+build.1", "1.2.0", true],
  ["1.2.0-beta.1", "1.2.0", false],
  ["1.2.0", "1.2.0-beta.1", true],
  ["1.2.0-beta.10", "1.2.0-beta.2", true],
  ["1.2.0-beta", "1.2.0-beta.1", false],
  ["garbage", "1.2.0", false],
])("release comparison %s >= %s", (current, required, expected) =>
  expect(versionAtLeast(current as string, required as string)).toBe(
    expected as boolean,
  ),
);

test("closing before entering workspace leaves the initial feature summary available next launch", () => {
  expect(
    guidePlan(status({ installedVersion: "1.2.0" }), "workspace")?.mode,
  ).toBe("welcome");
  expect(guidePlan(status({ installedVersion: null }), "workspace")?.mode).toBe(
    "updates",
  );
});

test("workspace and editor feature read states stay independent", () => {
  const state = status({ currentVersion: "1.2.0", seenGuides: seenBaseline });
  expect(guidePlan(state, "workspace")).toBeNull();
  const editor = guidePlan(state, "editor")!;
  expect(editor.guides.map((guide) => guide.id)).toEqual([
    "chapter-navigation",
    "editor-writing-basics",
    "editor-formatting",
    "editor-document-details",
    "editor-figures-tables",
    "editor-equations",
    "editor-citations",
    "editor-references-aliases",
    "editor-variables",
    "editor-review-save",
    "editor-sidebar",
  ]);
  expect(editor.guides.flatMap((guide) => guide.steps).length).toBeGreaterThan(
    20,
  );
  expect(
    guidePlan(
      {
        ...state,
        seenGuides: Object.fromEntries(
          guideAcknowledgments(editor).map(({ id, revision }) => [
            id,
            revision,
          ]),
        ),
      },
      "editor",
    ),
  ).toBeNull();
  expect(guidePlan({ ...state, currentVersion: "1.1.2" }, "editor")).toBeNull();
});

test("registry has unique feature IDs, valid revisions, named guides and translated target descriptions", async () => {
  const { default: en } = await import("../src/locales/en.json");
  const { default: id } = await import("../src/locales/id.json");
  const lookup = (data: unknown, key: string): unknown =>
    key
      .split(".")
      .reduce(
        (value, part) => (value as Record<string, unknown>)?.[part],
        data,
      );
  const guideIds = new Set<string>(),
    versions = new Set<string>();
  for (const release of GUIDE_RELEASES) {
    expect(versions.has(release.version)).toBe(false);
    versions.add(release.version);
    for (const guide of release.guides) {
      expect(guideIds.has(guide.id)).toBe(false);
      guideIds.add(guide.id);
      expect(guide.id).toMatch(/^[a-z0-9-]{1,100}$/);
      expect(Number.isSafeInteger(guide.revision)).toBe(true);
      expect(guide.revision).toBeGreaterThan(0);
      expect(guide.steps.length).toBeGreaterThan(1);
      expect(
        new Set(guide.steps.map((step) => step.description)).size,
      ).toBeGreaterThan(1);
      const textKeys = [guide.name, guide.summary];
      const stepIds = new Set<string>();
      for (const step of guide.steps) {
        expect(stepIds.has(step.id)).toBe(false);
        stepIds.add(step.id);
        expect(step.selectors.length).toBeGreaterThan(0);
        textKeys.push(step.title, step.description);
        if (step.fallbackDescription) textKeys.push(step.fallbackDescription);
        if (step.frozenDescription) textKeys.push(step.frozenDescription);
        if (step.example) textKeys.push(step.example);
        if (step.waitingDescription) textKeys.push(step.waitingDescription);
        if (guide.scope === "workspace")
          expect(step.route?.startsWith("/")).toBe(true);
      }
      for (const key of textKeys) {
        expect(typeof lookup(en, key)).toBe("string");
        expect(typeof lookup(id, key)).toBe("string");
      }
    }
  }
});

test("expanded baseline guides return once for users who saw their shorter revisions", () => {
  const old = Object.fromEntries(
    availableGuides("1.2.0", "workspace").map((guide) => [guide.id, 1]),
  );
  const previousEditor = Object.fromEntries(
    availableGuides("1.2.0", "editor").map((guide) => [
      guide.id,
      guide.revision,
    ]),
  );
  previousEditor["chapter-navigation"] = 2;
  previousEditor["editor-sidebar"] = 1;
  const state = status({
    currentVersion: "1.2.0",
    seenGuides: { ...old, ...previousEditor },
  });
  expect(
    guidePlan(state, "workspace")?.guides.map((guide) => guide.id),
  ).toEqual([
    "documents",
    "document-filters",
    "references",
    "document-exports",
  ]);
  expect(guidePlan(state, "editor")?.guides.map((guide) => guide.id)).toEqual([
    "chapter-navigation",
    "editor-sidebar",
  ]);
});
