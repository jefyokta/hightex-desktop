import { afterAll, beforeAll, expect, test } from "bun:test";
import { Schema } from "@tiptap/pm/model";
import type { EditorView } from "@tiptap/pm/view";
import {
  firstFragmentGlyph,
  fragmentAnchor,
  fragmentTextPosition,
} from "./helpers/legacy-pagination/fragment-content";

const box = (width: number, height = 18) =>
  ({ width, height, top: 150, bottom: 150 + height }) as DOMRect;
class Glyph {
  constructor(
    readonly data: string,
    readonly rect: DOMRect,
  ) {}
  get length() {
    return this.data.length;
  }
}
class ElementBox {
  constructor(
    readonly rect: DOMRect,
    readonly texts: Glyph[] = [],
  ) {}
  getBoundingClientRect() {
    return this.rect;
  }
}
const names = ["document", "HTMLElement", "Text", "NodeFilter"] as const;
const originals = new Map(
  names.map((name) => [
    name,
    Object.getOwnPropertyDescriptor(globalThis, name),
  ]),
);

beforeAll(() => {
  const document = {
    createTreeWalker(root: ElementBox) {
      let index = 0;
      return { nextNode: () => root.texts[index++] ?? null };
    },
    createRange() {
      let text: Glyph;
      return {
        setStart(node: Glyph) {
          text = node;
        },
        setEnd() {},
        getBoundingClientRect() {
          return text.rect;
        },
      };
    },
  };
  for (const [name, value] of Object.entries({
    document,
    HTMLElement: ElementBox,
    Text: Glyph,
    NodeFilter: { SHOW_TEXT: 4 },
  }))
    Object.defineProperty(globalThis, name, { configurable: true, value });
});
afterAll(() => {
  for (const name of names) {
    const original = originals.get(name);
    if (original) Object.defineProperty(globalThis, name, original);
    else Reflect.deleteProperty(globalThis, name);
  }
});

const schema = new Schema({
  nodes: {
    doc: { content: "paragraph+" },
    paragraph: { content: "inline*" },
    text: { group: "inline" },
    mathInline: { group: "inline", inline: true, atom: true },
  },
});
function fixture(text: boolean, dom?: ElementBox) {
  const atom = schema.node("mathInline");
  const paragraph = schema.node(
    "paragraph",
    null,
    text ? [atom, atom, schema.text("Following text"), atom] : [atom, atom],
  );
  const source = schema.node("doc", null, paragraph);
  const view = {
    state: { doc: source },
    nodeDOM: () => dom,
    coordsAtPos: () => box(1),
  } as unknown as EditorView;
  return { source, view };
}

test("empty leading inline atoms stay in the source while visible text locates the fragment", () => {
  const { source, view } = fixture(true, new ElementBox(box(0)));
  const before = source.toJSON();
  expect(fragmentTextPosition(view, 0, 0, source.content.size)).toBe(3);
  expect(source.toJSON()).toEqual(before);
  expect(source.firstChild?.childCount).toBe(4);
});

test("an atom-only empty paragraph uses its block anchor instead of requiring a glyph", () => {
  const { source, view } = fixture(false, new ElementBox(box(0)));
  expect(fragmentTextPosition(view, 0, 0, source.content.size)).toBeUndefined();
  expect(source.firstChild?.childCount).toBe(2);
});

test("missing DOM and visible textless atoms are not silently treated as empty content", () => {
  for (const dom of [undefined, new ElementBox(box(20))]) {
    const { source, view } = fixture(true, dom);
    expect(fragmentTextPosition(view, 0, 0, source.content.size)).toBe(1);
    expect(() => fragmentAnchor(view, 1)).toThrow(
      "Missing inline content anchor",
    );
  }
});

test("zero-size text boxes cannot displace a later visible glyph anchor", () => {
  const visible = box(9);
  const root = new ElementBox(box(0), [
    new Glyph("hidden", box(0, 0)),
    new Glyph("Visible", visible),
  ]);
  expect(firstFragmentGlyph(root as unknown as HTMLElement)).toBe(visible);
});
