import { expect, test } from "bun:test";
import { Schema, Slice, Fragment } from "@tiptap/pm/model";
import { pastedIdentities } from "../src/editor/extensions/uuid/pasted-identities";

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    text: { group: "inline" },
    paragraph: {
      group: "block",
      content: "inline*",
      attrs: { id: { default: null }, shouldUnique: { default: true } },
    },
    container: {
      group: "block",
      content: "block*",
      attrs: { id: { default: null }, shouldUnique: { default: true } },
    },
    refComponent: {
      group: "inline",
      inline: true,
      atom: true,
      attrs: { link: { default: "" } },
    },
  },
  marks: { bold: {} },
});
const paragraph = (id: string, link = id) =>
  schema.node("paragraph", { id }, [
    schema.text("Kept formatting", [schema.mark("bold")]),
    schema.node("refComponent", { link }),
  ]);

test("pasting before an existing target changes only the incoming identity and keeps references on the original", () => {
  const slice = new Slice(Fragment.from(paragraph("original")), 1, 1);
  const before = slice.toJSON();
  const result = pastedIdentities(slice, new Set(["original"]), () => "copy");
  expect(result.content.firstChild?.attrs.id).toBe("paragraph-copy");
  expect(result.content.firstChild?.lastChild?.attrs.link).toBe("original");
  expect(result.content.firstChild?.firstChild?.marks[0].type.name).toBe(
    "bold",
  );
  expect(result.openStart).toBe(1);
  expect(result.openEnd).toBe(1);
  expect(slice.toJSON()).toEqual(before);
});

test("a cut target absent from the destination retains its identity and link", () => {
  const slice = new Slice(Fragment.from(paragraph("moved")), 0, 0);
  expect(pastedIdentities(slice, new Set()).toJSON()).toEqual(slice.toJSON());
});

test("nested incoming identities avoid other chapters and IDs occurring later in the slice", () => {
  const suffixes = ["future", "copy", "parent"];
  const slice = new Slice(
    Fragment.from(
      schema.node("container", { id: "parent" }, [
        paragraph("remote"),
        paragraph("paragraph-future"),
      ]),
    ),
    0,
    0,
  );
  const result = pastedIdentities(
    slice,
    new Set(["remote"]),
    () => suffixes.shift()!,
  );
  expect(result.content.firstChild?.attrs.id).toBe("parent");
  expect(result.content.firstChild?.child(0).attrs.id).toBe("paragraph-copy");
  expect(result.content.firstChild?.child(0).lastChild?.attrs.link).toBe(
    "remote",
  );
  expect(result.content.firstChild?.child(1).attrs.id).toBe("paragraph-future");
});

test("legacy target remaps within incoming content while explicit identity opt-outs remain untouched", () => {
  const ignored = schema.node(
    "paragraph",
    { id: "opt-out", shouldUnique: false },
    schema.text("Opt out"),
  );
  const slice = new Slice(
    Fragment.fromArray([paragraph("123:legacy"), ignored]),
    0,
    0,
  );
  const result = pastedIdentities(slice, new Set(), () => "legacy");
  expect(result.content.firstChild?.attrs.id).toBe("paragraph-legacy");
  expect(result.content.firstChild?.lastChild?.attrs.link).toBe(
    "paragraph-legacy",
  );
  expect(result.content.lastChild?.toJSON()).toEqual(ignored.toJSON());
});
