import { freezeSectionLayout } from "../src/document-engine/layout/publish-layout";
import { expect, test } from "bun:test";
import { Schema } from "@tiptap/pm/model";
import { sectionLayoutEffects } from "../src/document-engine/layout/layout-effects";
import { sectionResultDecorations } from "../src/editor/pagination/section-result";
import { type SectionLayoutIdentity, type SectionLayoutResult } from "../shared/section-layout";
import type { PageLayout } from "../src/editor/pagination/flow/page-planner";

const identity: SectionLayoutIdentity = { documentId: "doc", sectionId: "doc.1", sourceHash: "a".repeat(64),
  optionsHash: "b".repeat(64), presentationHash: "c".repeat(64), resourcesHash: "d".repeat(64) };
const schema = new Schema({ nodes: { doc: { content: "block+" }, text: {},
  paragraph: { group: "block", content: "text*" },
  table: { group: "block", content: "row+", tableRole: "table" },
  row: { content: "cell+", tableRole: "row" }, cell: { content: "paragraph+", tableRole: "cell" },
  image: { group: "block", atom: true, attrs: { width: { default: 200 } } },
} });
const paragraph = schema.node("paragraph", null, schema.text("Original source"));
const row = schema.node("row", null, schema.node("cell", null, paragraph));
const table = schema.node("table", null, row), image = schema.node("image");
const source = schema.node("doc", null, [paragraph, table, image]);
const rowFrom = paragraph.nodeSize + 1, imageFrom = paragraph.nodeSize + table.nodeSize;
const plan = (): PageLayout => ({ pages: 2,
  breaks: [{ kind: "block", from: 0, to: paragraph.nodeSize, top: 800, bottom: 830, height: 224, marginTop: 12 },
    { kind: "line", from: 3, top: 900, bottom: 920, height: 200 }],
  rows: [{ from: rowFrom, to: rowFrom + row.nodeSize, height: 480 }],
  scales: [{ from: imageFrom, to: imageFrom + image.nodeSize, scale: 0.4 }],
  furniture: [{ top: 1148, left: 100, width: 400, html: "<table><tr><th>Repeat</th></tr></table>" }],
});
const result = (layout = plan()): SectionLayoutResult => ({ identity, sourceSize: source.content.size, pages: layout.pages,
  geometry: { width: 800, height: 1100, stride: 1124, margins: { top: 100, right: 100, bottom: 100, left: 100 } }, html: "<!doctype html><p>Canonical context</p>",
  sources: [], decisions: [], effects: sectionLayoutEffects(layout), targets: [], crossSectionTargets: [], links: [] });

test("the editor consumes the frozen calibrated effects without another plan or source transaction", () => {
  const builder = plan(), input = result(builder), ready = freezeSectionLayout(input);
  builder.breaks[0].height = 999;builder.rows![0].height = 999;builder.scales![0].scale = 0.9;
  builder.furniture![0].html = "Changed";
  const before = JSON.stringify(source.toJSON()), decorations = sectionResultDecorations(source, source, ready);
  expect(decorations.find()).toHaveLength(4);expect(JSON.stringify(source.toJSON())).toBe(before);
  expect(ready.effects.breaks[0].height).toBe(224);expect(ready.effects.rows![0].height).toBe(480);
  expect(ready.effects.scales![0].scale).toBe(0.4);expect(ready.effects.furniture![0].html).toContain("Repeat");
  for (const value of [ready.effects, ready.effects.breaks, ready.effects.breaks[0], ready.effects.rows![0], ready.effects.scales![0], ready.effects.furniture![0]])
    expect(Object.isFrozen(value)).toBe(true);
});

test("source changes cannot apply an old result to the editor", () => {
  const ready = freezeSectionLayout(result());
  const changed = schema.node("doc", null, [schema.node("paragraph", null, schema.text("Changed source!")), table, image]);
  expect(() => sectionResultDecorations(changed, source, ready)).toThrow("revision");

});

test("valid numeric ranges must also identify real source nodes and table rows", () => {
  for (const altered of [
    { ...plan(), breaks: [{ ...plan().breaks[0], to: paragraph.nodeSize - 1 }] },
    { ...plan(), rows: [{ from: 0, to: paragraph.nodeSize, height: 100 }] },
    { ...plan(), scales: [{ from: imageFrom, to: imageFrom, scale: 0.5 }] },
  ]) expect(() => {
    const ready = freezeSectionLayout(result(altered));sectionResultDecorations(source, source, ready);
  }).toThrow();
});

test("invalid effects fail before publishing any editor presentation", () => {
  const original = plan();
  for (const altered of [
    { ...original, breaks: [{ ...original.breaks[0], height: NaN }] },
    { ...original, breaks: [{ ...original.breaks[1], from: source.content.size + 1 }] },
    { ...original, rows: [{ ...original.rows![0], height: -1 }] },
    { ...original, scales: [{ ...original.scales![0], scale: Infinity }] },
    { ...original, furniture: [{ ...original.furniture![0], width: 0 }] },
  ]) expect(() => freezeSectionLayout(result(altered))).toThrow();
});

test("generated slots retain their own identity and immutable break geometry outside source ranges", () => {
  const input = result(), movement = { fromPage: 1, toPage: 2, beforeTop: 1000, beforeBottom: 1060,
    limit: 950, targetTop: 1124, displacement: 124 };
  const generated = [{ slot: "template-7", height: 124, marginTop: 24, reasons: ["overflow" as const], movement }];
  const composition = { html: '<section><div class="body"></div><p>Keywords</p></section>', bodySelector: ".body" };
  const ready = freezeSectionLayout({ ...input, composition, effects: { ...input.effects, generated } });
  movement.beforeTop = 42;composition.html = "Changed";
  expect(ready.effects.generated![0]).toMatchObject({ slot: "template-7", movement: { beforeTop: 1000 } });
  expect(ready.composition!.html).toContain("Keywords");
  for (const value of [ready.composition, ready.effects.generated, ready.effects.generated![0], ready.effects.generated![0].movement, ready.effects.generated![0].reasons])
    expect(Object.isFrozen(value)).toBe(true);
  for (const invalid of [
    { ...generated[0], slot: "" }, { ...generated[0], height: NaN },
  ]) expect(() => freezeSectionLayout({ ...input, composition, effects: { ...input.effects, generated: [invalid] } })).toThrow();
  expect(() => freezeSectionLayout({ ...input, effects: { ...input.effects, generated } })).toThrow();
  expect(() => freezeSectionLayout({ ...input, composition, effects: { ...input.effects, generated: [...generated, ...generated] } })).toThrow();
});

test("one generated slot can retain several distinct immutable inline cuts", () => {
  const input = result();
  const movement = { fromPage: 1, toPage: 2, beforeTop: 1000, beforeBottom: 1020,
    limit: 950, targetTop: 1124, displacement: 124 };
  const generated = [10, 80].map(offset => ({ slot: "template-7", offset, height: 124, marginTop: 0,
    reasons: ["overflow" as const], movement }));
  const composition = { html: '<section><div class="body"></div><p>Long keywords</p></section>', bodySelector: ".body" };
  const ready = freezeSectionLayout({ ...input, composition, effects: { ...input.effects, generated } });
  generated[0].offset = 999;
  expect(ready.effects.generated?.map(item => item.offset)).toEqual([10, 80]);
  expect(Object.isFrozen(ready.effects.generated?.[0])).toBe(true);
  for (const offset of [-1, 0.5, NaN])
    expect(() => freezeSectionLayout({ ...input, composition, effects: { ...input.effects,
      generated: [{ ...generated[0], offset }] } })).toThrow();
});

test("published margins belong to the layout revision and cannot follow builder mutations", () => {
  const input = result(), ready = freezeSectionLayout(input);
  (input.geometry.margins as { top: number }).top = 999;
  expect(ready.geometry.margins.top).toBe(100);expect(Object.isFrozen(ready.geometry.margins)).toBe(true);
  for (const margins of [
    { ...ready.geometry.margins, top: NaN }, { ...ready.geometry.margins, left: -1 },
    { ...ready.geometry.margins, top: 1100 }, { ...ready.geometry.margins, right: 800 },
  ]) expect(() => freezeSectionLayout({ ...input, geometry: { ...input.geometry, margins } })).toThrow();
});

test("derived outline anchors decorate the source without authoring IDs or accepting duplicate targets", () => {
  const input = result(), anchors = [{ from: 0, to: paragraph.nodeSize, id: "abstract-id" }];
  const ready = freezeSectionLayout({ ...input, effects: { ...input.effects, anchors } });
  const before = JSON.stringify(source.toJSON());
  expect(sectionResultDecorations(source, source, ready).find()).toHaveLength(5);
  expect(JSON.stringify(source.toJSON())).toBe(before);expect(Object.isFrozen(ready.effects.anchors![0])).toBe(true);
  expect(() => freezeSectionLayout({ ...input, effects: { ...input.effects, anchors: [...anchors, ...anchors] } })).toThrow();
});
