import { expect, test } from "bun:test";
import { ChapterImageResources } from "../src/editor/chapter/image-resources";

test("views share a snapshot image URL until its owner is disposed", async () => {
  const bytes = new TextEncoder().encode("immutable image fixture");
  const images = { photo: { bytes, mime: "image/webp" } };
  const owner = new ChapterImageResources(images);
  const first = owner.url("photo")!;
  const second = owner.url("photo")!;
  expect(first).toBe(second);
  expect(await (await fetch(second)).text()).toBe("immutable image fixture");
  owner.dispose();owner.dispose();
  expect(() => owner.url("photo")).toThrow("disposed");
  await expect(fetch(first)).rejects.toThrow();
  expect(Array.from(images.photo.bytes)).toEqual(Array.from(bytes));
});

test("missing inputs stay unresolved and portable images do not allocate a URL", () => {
  const owner = new ChapterImageResources({});
  const portable = "data:image/png;base64,aW1hZ2U=";
  expect(owner.url("missing")).toBeUndefined();
  expect(owner.url(portable)).toBe(portable);
  expect(owner.url("https://example.com/image.webp")).toBeUndefined();
  owner.dispose();
});

test("a new source revision owns different URLs and cannot be released by the old owner", async () => {
  const first = new ChapterImageResources({ image: { bytes: new Uint8Array([1]), mime: "image/png" } });
  const second = new ChapterImageResources({ image: { bytes: new Uint8Array([2]), mime: "image/png" } });
  const oldURL = first.url("image")!, nextURL = second.url("image")!;
  expect(oldURL).not.toBe(nextURL);
  first.dispose();
  expect(Array.from(new Uint8Array(await (await fetch(nextURL)).arrayBuffer()))).toEqual([2]);
  second.dispose();
});
