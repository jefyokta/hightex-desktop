import { expect, test } from "bun:test";
import { Schema } from "@tiptap/pm/model";
import { paginationListItems } from "./helpers/legacy-pagination/list-items";

const schema = new Schema({ nodes: {
  doc: { content: "block+" }, text: {}, paragraph: { group: "block", content: "text*" },
  orderedList: { group: "block", content: "listItem+", attrs: { start: { default: 1 } } },
  bulletList: { group: "block", content: "listItem+" }, listItem: { content: "paragraph block*" },
} });
const p = (text: string) => schema.node("paragraph", null, schema.text(text));
const li = (text: string) => schema.node("listItem", null, p(text));

test("source list ordinals preserve starts and nested scopes without counting omitted DOM siblings", () => {
  const nested = schema.node("orderedList", { start: 27 }, [li("Nested A"), li("Nested B")]);
  const source = schema.node("doc", null, [schema.node("orderedList", { start: 7 }, [
    schema.node("listItem", null, [p("First"), nested]),li("Second"),
  ]),schema.node("bulletList", null, li("Bullet"))]);
  const before = source.toJSON();
  const items = [...paginationListItems(source).values()];
  expect(items.map(item => item.number)).toEqual([7,27,28,8,undefined]);
  expect(items.every(item => item.to > item.from + 1)).toBe(true);
  expect(items[0].to).toBeGreaterThan(items[2].to);
  expect(source.toJSON()).toEqual(before);
});
