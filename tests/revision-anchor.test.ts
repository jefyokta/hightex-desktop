import { expect, test } from "bun:test";
import { readSnapshot } from "../src/review/snapshot-reader";
import { revisionLocations, resolveRevisionAnchor } from "../src/review/revision-anchor";
import { zipSync, strToU8 } from "fflate";

const encode = (value: unknown) => strToU8(JSON.stringify(value));
const file = (text: string) => zipSync({
  "manifest.json": encode({ format: "json", schema_version: 2, document: { id: "doc", title: { id: "Thesis" } } }),
  "files/chapters/1.json": encode([
    { type: "paragraph", attrs: { id: "paragraph" }, content: [{ type: "text", text }] },
    { type: "imageFigure", attrs: { id: "image" }, content: [{ type: "image", attrs: { src: "image" } }] },
  ]),
});

test("revision anchors identify the original snapshot, path, source identity and quote", async () => {
  const snapshot = await readSnapshot(file("Metode penelitian"), { kind: "local", filename: "fixture.hightex" });
  const locations = revisionLocations(snapshot);
  expect(locations).toHaveLength(2);
  const anchor = locations[0].anchor;
  expect(resolveRevisionAnchor(snapshot, anchor)).toEqual(snapshot.chapters[0].content[0]);
  expect(resolveRevisionAnchor(snapshot, { ...anchor, nodeId: "other" })).toBeUndefined();
  expect(resolveRevisionAnchor(snapshot, { ...anchor, path: [50] })).toBeUndefined();
  expect(resolveRevisionAnchor(snapshot, { ...anchor, quote: "Changed" })).toBeUndefined();
  const updated = await readSnapshot(file("Metode baru"), { kind: "local", filename: "fixture.hightex" });
  expect(resolveRevisionAnchor(updated, anchor)).toBeUndefined();
  expect(locations[1].anchor.quote).toBe("imageFigure");
});
