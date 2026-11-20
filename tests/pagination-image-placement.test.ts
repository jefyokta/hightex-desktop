import { expect, test } from "bun:test";
import { assertPageImagePlacement } from "../src/editor/pagination/measurement/image-placement";
import { PaginationImageError } from "../src/exception/pagination-image-error";
import { paginationGeometry } from "../src/editor/pagination/options";

const geometry = paginationGeometry();
const rect = (left: number, top: number, width: number, height: number) => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
});
const paper = rect(0, 0, geometry.width, geometry.height);
const image = (top: number, height = 100, width = 100) =>
  rect(geometry.margins.left, top, width, height);

test("a fitted image is accepted on its actual recorded page without mutating dimensions", () => {
  const bounds = image(geometry.stride + geometry.margins.top);
  const before = { ...bounds };
  expect(() =>
    assertPageImagePlacement(bounds, paper, geometry, 1),
  ).not.toThrow();
  expect(bounds).toEqual(before);
});

test("an image can fit the page size but still cross a page cut", () => {
  const bounds = image(geometry.height - geometry.margins.bottom - 30);
  let caught: unknown;
  try {
    assertPageImagePlacement(bounds, paper, geometry, 2);
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(PaginationImageError);
  const error = caught as PaginationImageError;
  expect(error.code).toBe("pagination.image.outside-page");
  expect(error.level).toBe("fatal");
  expect(error.details).toMatchObject({
    image: 2,
    page: 1,
    reason: "position",
  });
  if (error.details.code === "pagination.image.outside-page")
    expect(error.details.overflow.bottom).toBeCloseTo(70);
});

test("unfitted and unmeasurable images have structured, distinct causes", () => {
  for (const [bounds, reason] of [
    [image(geometry.margins.top, geometry.contentHeight + 10), "size"],
    [image(geometry.margins.top, 0), "unmeasurable"],
  ] as const) {
    expect(() => assertPageImagePlacement(bounds, paper, geometry, 1)).toThrow(
      PaginationImageError,
    );
    try {
      assertPageImagePlacement(bounds, paper, geometry, 1);
    } catch (error) {
      expect((error as PaginationImageError).details).toMatchObject({ reason });
    }
  }
});

test("image resource errors expose stable codes without message classification", () => {
  const error = new PaginationImageError({
    code: "pagination.image.changed",
    image: 3,
  });
  expect(error.details).toEqual({ code: "pagination.image.changed", image: 3 });
  expect(Object.isFrozen(error.details)).toBe(true);
});
