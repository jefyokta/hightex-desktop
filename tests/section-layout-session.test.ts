import { freezeSectionLayout } from "../src/document-engine/layout/publish-layout";
import { expect, test } from "bun:test";
import { SectionLayoutSession } from "../src/document-engine/layout/layout-session";
import { sectionLayoutKey, type SectionLayoutDecision, type SectionLayoutIdentity, type SectionLayoutResult } from "../shared/section-layout";
import { documentSourceTargets } from "../src/document-engine/projection/source-map";

const identity = (source = "a"): SectionLayoutIdentity => ({ documentId: "document", sectionId: "document.4",
  sourceHash: source.repeat(64), optionsHash: "b".repeat(64), presentationHash: "c".repeat(64), resourcesHash: "d".repeat(64) });
const result = (input = identity()): SectionLayoutResult => {
  const source = { chapterId: input.sectionId, sourceRevision: input.sourceHash, from: 1, to: 2, nodeId: "figure", assetId: "asset" };
  return { identity: input, sourceSize: 10, pages: 2, geometry: { width: 800, height: 1100, stride: 1124, margins: { top: 100, right: 100, bottom: 100, left: 100 } },
    html: "<!doctype html><p>Frozen rendered source</p>", sources: [source], decisions: [], effects: { breaks: [] },
    targets: [{ id: "figure", page: 2, x: 100, y: 150, source }], crossSectionTargets: [],
    links: [{ target: "figure", page: 1, x: 100, y: 100, width: 80, height: 20, source }] };
};

test("published geometry, context, identity and locators cannot be changed through builder aliases", () => {
  const input = result(), published = freezeSectionLayout(input);
  (input.geometry as { width: number }).width = 42;
  (input.identity as { sourceHash: string }).sourceHash = "e".repeat(64);
  (input.sources[0] as { from: number }).from = 9;
  (input.targets as unknown[]).push({});
  expect(published.geometry.width).toBe(800);expect(published.identity.sourceHash).toBe("a".repeat(64));
  expect(published.sources[0].from).toBe(1);expect(published.targets.length).toBe(1);
  for (const value of [published, published.geometry, published.identity, published.sources, published.sources[0], published.targets[0], published.targets[0].source, published.links[0]])
    expect(Object.isFrozen(value)).toBe(true);
});

test("known cross-chapter references retain source ownership until document placement", () => {
  const input = result();
  const crossSectionTargets = [{ id: "other-figure", chapterId: "document.5" }];
  const links = [{ ...input.links[0], target: "other-figure" }];
  const published = freezeSectionLayout({ ...input, crossSectionTargets, links });
  crossSectionTargets[0].chapterId = "document.6";
  expect(published.crossSectionTargets).toEqual([{ id: "other-figure", chapterId: "document.5" }]);
  expect(Object.isFrozen(published.crossSectionTargets[0])).toBe(true);
  for (const target of [
    { id: "other-figure", chapterId: "foreign.5" },
    { id: "other-figure", chapterId: "document.4" },
    { id: "other-figure", chapterId: "document." },
  ]) expect(() => freezeSectionLayout({ ...input, crossSectionTargets: [target], links })).toThrow();
});

test("layout warnings preserve their reason and immutable source when published", () => {
  const input = result();
  const issue = { kind: "table" as const, key: "table", message: "Pengulangan header ringkas", source: { ...input.sources[0] } };
  const published = freezeSectionLayout({ ...input, issues: [issue] });
  issue.message = "changed";issue.source.from = 5;
  expect(published.issues?.[0].message).toBe("Pengulangan header ringkas");
  expect(published.issues?.[0].source?.from).toBe(1);
  expect(Object.isFrozen(published.issues?.[0])).toBe(true);
});

test("cross-chapter ownership keeps the first source ID when later chapters repeat it", () => {
  const chapters = [
    { id: "document.4", content: [{ type: "paragraph", attrs: { id: "first" } }] },
    { id: "document.5", content: [{ type: "imageFigure", attrs: { id: "second", label: "Gambar 999" } }] },
  ];
  const before = JSON.stringify(chapters), owners = documentSourceTargets(chapters);
  expect([...owners]).toEqual([["first", "document.4"], ["second", "document.5"]]);
  expect(JSON.stringify(chapters)).toBe(before);
  expect([...documentSourceTargets([...chapters, { id: "document.6", content: chapters[0].content }])]).toEqual([...owners]);
});

test("late completions cannot publish after a newer source revision", () => {
  const session = new SectionLayoutSession(() => {}), first = session.begin(identity());
  session.invalidate("source");
  const second = session.begin(identity("e"));
  expect(first.signal.aborted).toBe(true);
  expect(() => session.publish(first, result())).toThrow();
  const ready = session.publish(second, result(identity("e")));
  expect(() => session.publish(second, ready)).toThrow("Stale");session.dispose();
});

test("invalidating preserves consumer-owned output and reports its published identity", () => {
  const session = new SectionLayoutSession(() => {}), job = session.begin(identity());
  const chosen = session.publish(job, result());
  const previous: unknown[] = [];
  session.events.on("layout.invalidated", event => { previous.push(event.previous); });
  session.invalidate("resources");
  expect(previous).toEqual([chosen.identity]);
  expect(() => session.publish(job, chosen)).toThrow("Stale");
  expect(chosen.html).toContain("Frozen rendered source");
  expect(chosen.targets[0].source.assetId).toBe("asset");
  session.dispose();
});

test("source/options/presentation/resource identities all participate in matching a result", () => {
  const original = identity(), key = sectionLayoutKey(original);
  for (const field of ["sourceHash", "optionsHash", "presentationHash", "resourcesHash"] as const) {
    const changed = { ...original, [field]: "f".repeat(64) };
    expect(sectionLayoutKey(changed)).not.toBe(key);
    const session = new SectionLayoutSession(() => {}), job = session.begin(original);
    expect(() => session.publish(job, result(changed))).toThrow("identity");session.dispose();
  }
});

test("parent cancellation and disposal invalidate pending work and detach its listeners", () => {
  const source = new AbortController(), session = new SectionLayoutSession(() => {});
  const job = session.begin(identity(), source.signal);
  source.abort(new Error("Source closed"));expect(job.signal.aborted).toBe(true);
  expect(() => session.publish(job, result())).toThrow("Source closed");
  const parent = new AbortController(), next = session.begin(identity(), parent.signal);
  const ready = session.publish(next, result());parent.abort();
  expect(next.signal.aborted).toBe(false);expect(ready.identity).toEqual(identity());
  const pending = session.begin(identity());session.dispose();session.dispose();
  expect(pending.signal.aborted).toBe(true);expect(() => session.begin(identity())).toThrow("disposed");
});

test("invalidation observers cannot replace the outcome or retain listeners after disposal", async () => {
  const errors: unknown[] = [], notices: string[] = [];
  const session = new SectionLayoutSession(error => errors.push(error));
  session.events.on("layout.invalidated", event => { notices.push(event.reason);throw Error("Observer failed"); });
  session.events.on("layout.invalidated", async () => { throw Error("Async observer failed"); });
  const job = session.begin(identity());session.invalidate("options");await Promise.resolve();
  expect(job.signal.aborted).toBe(true);expect(notices).toEqual(["options"]);expect(errors.length).toBe(2);
  session.dispose();session.invalidate("source");expect(notices.length).toBe(1);
});

test("foreign source ranges and off-page links never become ready", () => {
  for (const change of [
    (input: SectionLayoutResult) => ({ ...input, sources: [{ ...input.sources[0], sourceRevision: "f".repeat(64) }] }),
    (input: SectionLayoutResult) => ({ ...input, sources: [{ ...input.sources[0], to: 20 }] }),
    (input: SectionLayoutResult) => ({ ...input, links: [{ ...input.links[0], target: "deleted" }] }),
    (input: SectionLayoutResult) => ({ ...input, links: [{ ...input.links[0], y: 1099 }] }),
  ]) {
    const session = new SectionLayoutSession(() => {}), job = session.begin(identity());
    expect(() => session.publish(job, change(result()))).toThrow();
    session.dispose();
  }
});

test("published split causes, image fitting and table furniture retain immutable source provenance", () => {
  const input = result(), source = { ...input.sources[0] }, trigger = { ...source, from: 2, to: 3 };
  const decisions: SectionLayoutDecision[] = [
    { kind: "break", source, trigger, container: source, placement: "line", reasons: ["overflow", "widow"],
      fromPage: 1, toPage: 2, beforeTop: 900, beforeBottom: 920, limit: 950, targetTop: 1124, displacement: 224 },
    { kind: "fit", source, scale: 0.5, availableHeight: 850 },
    { kind: "table-continuation", source, page: 2, x: 100, y: 100, width: 400, height: 60 },
  ];
  const published = freezeSectionLayout({ ...input, decisions });
  trigger.from = 9;source.figureId = "changed";
  const mutableReasons = decisions[0].kind === "break" ? decisions[0].reasons as string[] : [];
  mutableReasons.push("changed");
  expect(published.decisions[0]).toMatchObject({ trigger: { from: 2 }, reasons: ["overflow", "widow"] });
  for (const decision of published.decisions) {
    expect(Object.isFrozen(decision)).toBe(true);expect(Object.isFrozen(decision.source)).toBe(true);
  }
  const cut = published.decisions[0];
  if (cut.kind !== "break") throw Error("Expected split decision");
  expect(Object.isFrozen(cut.reasons)).toBe(true);expect(Object.isFrozen(cut.trigger)).toBe(true);

});


test("published destination ownership retains the first target and ignores later duplicates", () => {
  const input = result();
  const published = freezeSectionLayout({ ...input,
    targets: [...input.targets, { ...input.targets[0], page: 999, x: -100 }],
    crossSectionTargets: [{ id: input.targets[0].id, chapterId: "document.5" }],
  });
  expect(published.targets).toEqual(input.targets);
  expect(published.crossSectionTargets).toEqual([]);
});
