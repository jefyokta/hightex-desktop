import { expect, test } from "bun:test";
import { Schema } from "@tiptap/pm/model";
import { sectionSourceLocator } from "../src/document-engine/layout/source-locator";
import { sectionLayoutDecisions } from "../src/document-engine/layout/layout-decisions";
import { paginateUnits } from "../src/editor/pagination/flow/page-planner";
import { DEFAULT_PAGINATION } from "../src/editor/pagination/options";
import type { SectionLayoutIdentity } from "../shared/section-layout";

const identity: SectionLayoutIdentity = { documentId: "doc", sectionId: "doc.4", sourceHash: "a".repeat(64),
  optionsHash: "b".repeat(64), presentationHash: "c".repeat(64), resourcesHash: "d".repeat(64) };
const schema = new Schema({ nodes: {
  doc: { content: "block+" }, text: {},
  paragraph: { group: "block", content: "text*", attrs: { id: { default: null } } },
  image: { atom: true, attrs: { id: { default: null }, src: { default: "" } } },
  imageFigure: { group: "block", content: "image paragraph", attrs: { id: {}, figureId: {} } },
} });
const image = schema.node("image", { src: "asset-key" });
const figure = schema.node("imageFigure", { id: "figure-id", figureId: "authored-figure" },
  [image, schema.node("paragraph", null, schema.text("Caption"))]);
const paragraph = schema.node("paragraph", { id: "paragraph-id" }, schema.text("Paragraph text"));
const model = schema.node("doc", null, [figure, paragraph]);

test("anonymous image positions retain their parent figure and asset without changing source IDs", () => {
  const before = JSON.stringify(model.toJSON());
  expect(sectionSourceLocator(model, identity, 1, 2)).toEqual({ chapterId: "doc.4", sourceRevision: identity.sourceHash,
    from: 1, to: 2, nodeId: "figure-id", figureId: "authored-figure", assetId: "asset-key" });
  const inline = sectionSourceLocator(model, identity, figure.nodeSize + 3);
  expect(inline.nodeId).toBe("paragraph-id");expect(inline.from).toBe(inline.to);
  expect(inline.figureId).toBeUndefined();expect(inline.assetId).toBeUndefined();
  expect(JSON.stringify(model.toJSON())).toBe(before);
  for (const [from, to] of [[-1, 0], [2, 1], [0, model.content.size + 1], [1.5, 2]])
    expect(() => sectionSourceLocator(model, identity, from, to)).toThrow("range");
});

test("a moved figure keeps the actual planner cause and measurement coordinates on its frozen revision", () => {
  const { contentHeight, stride } = DEFAULT_PAGINATION;
  const plan = paginateUnits([{ from: 0, to: figure.nodeSize, top: contentHeight - 100,
    bottom: contentHeight + 100, kind: "block" }]);
  const decisions = sectionLayoutDecisions(model, identity, plan.decisions!);
  expect(decisions[0]).toMatchObject({ kind: "break", source: { from: 0, to: figure.nodeSize,
    nodeId: "figure-id", figureId: "authored-figure", assetId: "asset-key", sourceRevision: identity.sourceHash },
    trigger: { from: 0 }, reasons: ["overflow"], fromPage: 1, toPage: 2,
    beforeTop: contentHeight - 100, beforeBottom: contentHeight + 100, limit: contentHeight, targetTop: stride });
  plan.decisions![0].from = figure.nodeSize;
  expect(decisions[0].source.from).toBe(0);
});
