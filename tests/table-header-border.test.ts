import { expect, test } from "bun:test";
import { headerLikeRowIndexes } from "../src/editor/plugins/table-border";

test("header rowspan endpoints group the complete final header row", () => {
  expect(
    headerLikeRowIndexes([
      [
        { header: true, rowspan: 2 },
        { header: true, rowspan: 1 },
      ],
      [
        { header: false, rowspan: 1 },
        { header: false, rowspan: 1 },
      ],
      [{ header: false, rowspan: 1 }],
    ]),
  ).toEqual([1]);
  expect(
    headerLikeRowIndexes([
      [
        { header: true, rowspan: 3 },
        { header: true, rowspan: 2 },
      ],
      [{ header: false, rowspan: 1 }],
      [{ header: false, rowspan: 1 }],
    ]),
  ).toEqual([2, 1]);
});

test("normal body rowspans and out-of-range headers do not create header-like rows", () => {
  expect(
    headerLikeRowIndexes([
      [
        { header: true, rowspan: 1 },
        { header: true, rowspan: 20 },
      ],
      [{ header: false, rowspan: 2 }],
      [{ header: false, rowspan: 1 }],
    ]),
  ).toEqual([]);
});
