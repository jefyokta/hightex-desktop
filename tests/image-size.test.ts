import { expect, test } from "bun:test";
import { DEFAULT_IMAGE_WIDTH, imageWidth } from "../src/editor/extensions/image/size";

test("invalid image widths use the schema default while valid widths survive", () => {
  for (const value of [null, undefined, "", "bad", 0, -1, NaN, Infinity, {}, true])
    expect(imageWidth(value)).toBe(DEFAULT_IMAGE_WIDTH);
  expect(DEFAULT_IMAGE_WIDTH).toBe(200);
  for (const value of [50, 400, "800"]) expect(imageWidth(value)).toBe(Number(value));
});
