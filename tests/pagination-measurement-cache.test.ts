import { expect, test } from "bun:test";
import { Schema } from "@tiptap/pm/model";
import { FlowCache } from "../src/editor/pagination/flow/text-flow";

const schema = new Schema({ nodes: { doc: { content: "paragraph+" }, text: {},
  paragraph: { content: "text*", attrs: { id: { default: null } } } } });
const paragraph = (text: string) => schema.node("paragraph", { id: "same" }, schema.text(text));

test("measurement reuse survives schema round-trips but never treats an ID as content authority", () => {
  const original = paragraph("Original"), restored = schema.nodeFromJSON(original.toJSON());
  const cache = new FlowCache(), lines = [{ from: 1, top: 0, bottom: 24 }];
  cache.set(original, 400, "font/style", lines);
  expect(restored).not.toBe(original);
  expect(cache.get(restored, 400, "font/style")).toEqual(lines);
  expect(cache.get(paragraph("Changed"), 400, "font/style")).toBeUndefined();
  expect(cache.get(restored, 300, "font/style")).toBeUndefined();
  expect(cache.get(restored, 400, "new font/style")).toBeUndefined();
  cache.clear();expect(cache.get(original, 400, "font/style")).toBeUndefined();
});

test("table repeats invalidate with content, geometry/context or explicit node invalidation", () => {
  const original = paragraph("Header"), restored = schema.nodeFromJSON(original.toJSON()), cache = new FlowCache();
  const furniture = { height: 24, html: "<table>Header</table>", compact: false };
  cache.setFurniture(original, "resolved presentation", furniture);
  expect(cache.getFurniture(restored, "resolved presentation")).toEqual(furniture);
  expect(cache.getFurniture(restored, "changed geometry")).toBeUndefined();
  expect(cache.getFurniture(paragraph("Other header"), "resolved presentation")).toBeUndefined();
  cache.invalidate(original);expect(cache.getFurniture(original, "resolved presentation")).toBeUndefined();
  cache.clear();expect(cache.getFurniture(restored, "resolved presentation")).toBeUndefined();
});
