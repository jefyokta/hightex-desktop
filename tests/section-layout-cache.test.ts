import { freezeSectionLayout } from "../src/document-engine/layout/publish-layout";
import { expect, test } from "bun:test";
import { SectionLayoutCache } from "../src/document-engine/layout/layout-cache";
import { type SectionLayoutIdentity, type SectionLayoutResult } from "../shared/section-layout";
import { SectionLayoutSession } from "../src/document-engine/layout/layout-session";
import { Schema } from "@tiptap/pm/model";
import { chapterLayoutResources } from "../src/editor/chapter/layout-dependencies";
import type { DocumentRenderModel } from "../src/types/document-snapshot";
import type { chapterRenderContext } from "../src/editor/chapter/render-context";
import { intersectLayoutRect } from "../src/document-engine/projection/rect";

const identity: SectionLayoutIdentity = { documentId: "doc", sectionId: "doc.1", sourceHash: "a".repeat(64),
  optionsHash: "b".repeat(64), presentationHash: "c".repeat(64), resourcesHash: "d".repeat(64) };
const result = (input = identity): Readonly<SectionLayoutResult> => freezeSectionLayout({
  identity: input, sourceSize: 0, pages: 1, geometry: { width: 800, height: 1100, stride: 1124,
    margins: { top: 100, right: 100, bottom: 100, left: 100 } }, html: '<div class="page"><div class="tiptap"></div></div>',
  sources: [], decisions: [], effects: { breaks: [] }, targets: [], links: [], crossSectionTargets: [],
});

test("consumers reuse the published object while compatibility plans stay isolated", () => {
  const cache = new SectionLayoutCache(), ready = result(), plan = { pages: 1, breaks: [] };
  cache.set(ready, plan);plan.pages = 9;
  const selected = cache.get(identity)!;
  expect(selected.result).toBe(ready);expect(selected.plan.pages).toBe(1);
  selected.plan.pages = 7;
  expect(cache.get(identity)!.plan.pages).toBe(1);
  const session = new SectionLayoutSession(() => {}), job = session.begin(identity);
  expect(session.publish(job, selected.result)).toBe(ready);
  for (const field of ["sourceHash", "optionsHash", "presentationHash", "resourcesHash"] as const)
    expect(cache.get({ ...identity, [field]: "e".repeat(64) })).toBeUndefined();
  session.dispose();
});

test("memory is bounded and LRU eviction never changes a consumer's selected result", () => {
  const probe = new SectionLayoutCache(), first = result();probe.set(first, { pages: 1, breaks: [] });
  const cache = new SectionLayoutCache(probe.stats.bytes * 2 + 20);
  const second = result({ ...identity, sectionId: "doc.2" }), third = result({ ...identity, sectionId: "doc.3" });
  for (const item of [first, second]) cache.set(item, { pages: 1, breaks: [] });
  cache.get(first.identity);
  cache.set(third, { pages: 1, breaks: [] });
  expect(cache.get(second.identity)).toBeUndefined();
  expect(cache.get(first.identity)!.result).toBe(first);
  expect(cache.stats.bytes).toBeLessThanOrEqual(probe.stats.bytes * 2 + 20);
  cache.clear();expect(cache.stats.entries).toBe(0);expect(first.html).toContain("tiptap");
});

test("chapter dependencies ignore other body text but invalidate used values, targets and image bytes", async () => {
  const schema = new Schema({ nodes: { doc: { content: "paragraph+" }, text: { group: "inline" },
    paragraph: { content: "inline*" }, variable: { inline: true, group: "inline", atom: true, attrs: { name: {} } },
    refComponent: { inline: true, group: "inline", atom: true, attrs: { ref: {}, link: {} } },
    image: { inline: true, group: "inline", atom: true, attrs: { src: {} } } } });
  const source = schema.node("doc", null, schema.node("paragraph", null, [schema.node("variable", { name: "used" }),
    schema.node("refComponent", { ref: "imageFigure", link: "target" }), schema.node("image", { src: "photo" })]));
  const model = { document: { title: "Title", altTitle: "" }, variables: [{ name: "used", value: "first" }], references: {},
    chapters: [{ id: "2", content: [] }], images: { photo: { bytes: new Uint8Array([1]), mime: "image/png" } } } as unknown as DocumentRenderModel;
  const labels = new Map([["target", "Gambar 2.1"]]);
  const context = { referenceLabels: { imageFigure: labels }, equations: [], captionLabels: new Map() } as unknown as ReturnType<typeof chapterRenderContext>;
  const owners = new Map([["target", "doc.2"]]);
  const images = { fingerprint: async () => String(model.images.photo.bytes[0]) };
  const fingerprint = () => chapterLayoutResources(source, model, context, owners, images);
  const initial = await fingerprint();
  model.chapters[0].content = [{ type: "paragraph", content: [{ type: "text", text: "Unrelated edit" }] }];
  model.variables.push({ name: "unused", value: "ignored" });
  expect(await fingerprint()).toBe(initial);
  model.variables[0].value = "second";expect(await fingerprint()).not.toBe(initial);model.variables[0].value = "first";
  labels.set("target", "Gambar 2.2");expect(await fingerprint()).not.toBe(initial);labels.set("target", "Gambar 2.1");
  model.images.photo.bytes[0] = 2;expect(await fingerprint()).not.toBe(initial);
});

test("template link annotations follow the clipped column, including partially visible links", () => {
  const clip = { left: 113, top: 113, right: 680, bottom: 1009 };
  expect(intersectLayoutRect({ left: 704, top: 120, right: 1271, bottom: 146 }, clip)).toBeUndefined();
  expect(intersectLayoutRect({ left: 120, top: 1000, right: 200, bottom: 1026 }, clip))
    .toEqual({ left: 120, top: 1000, right: 200, bottom: 1009, width: 80, height: 9 });
});
