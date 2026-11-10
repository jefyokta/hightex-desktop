import { expect, test } from "bun:test";
import { getSchema } from "@tiptap/core";
import { ChapterExtensions } from "../src/editor/chapter/chapter-extensions";
import {
  matchFigureImage,
  matchFigureTable,
} from "../src/editor/extensions/node-shortcut/parse";
import { createFigureImage } from "../src/editor/utils/create-figure-image";
import { createFigureTable } from "../src/editor/utils/create-figure-table";

const schema = getSchema(ChapterExtensions.contentSchema("attachment"));

test.each([
  [3, 4],
  [8, 9],
  [10, 11],
  [12, 15],
  [15, 12],
  [20, 30],
])("!tab.%i.%i keeps the requested columns and rows", (cols, rows) => {
  const parsed = matchFigureTable(`tab.${cols}.${rows}.Data_Mahasiswa`);
  if (!parsed) throw new Error("Table shortcut was not recognized");
  const figure = schema.nodeFromJSON(
    createFigureTable(parsed.rows, parsed.cols, parsed.caption),
  );
  figure.check();
  expect(figure.firstChild?.textContent).toBe("Data Mahasiswa");
  const table = figure.lastChild!;
  expect(table.childCount).toBe(rows);
  table.forEach((row, _offset, index) => {
    expect(row.childCount).toBe(cols);
    row.forEach((cell) => {
      expect(cell.type.name).toBe(index === 0 ? "tableHeader" : "tableCell");
    });
  });
});

test("table dimensions above ten work without a caption or with only columns", () => {
  expect(matchFigureTable("tab.12.15")).toEqual({
    cols: 12,
    rows: 15,
    caption: "",
  });
  expect(matchFigureTable("tab.12.15.")).toEqual({
    cols: 12,
    rows: 15,
    caption: "",
  });
  expect(matchFigureTable("tab.12")).toEqual({
    cols: 12,
    rows: 3,
    caption: "",
  });
});

test("only the command is case insensitive; table captions retain their case", () => {
  expect(matchFigureTable("TAB.12.15.Data_API_Mahasiswa")).toEqual({
    cols: 12,
    rows: 15,
    caption: "Data API Mahasiswa",
  });
});

test.each([
  ["fig.Gambar_Data_Mahasiswa", "Gambar Data Mahasiswa"],
  ["FIG.Diagram_API_Sistem", "Diagram API Sistem"],
  ["fig.Diagram_Évaluasi", "Diagram Évaluasi"],
])(
  "!%s produces a valid figure with its complete caption",
  (query, caption) => {
    const parsed = matchFigureImage(query);
    if (!parsed || typeof parsed === "boolean")
      throw new Error("Image shortcut caption was not recognized");
    const figure = schema.nodeFromJSON(createFigureImage(null, parsed.caption));
    figure.check();
    expect(figure.firstChild?.type.name).toBe("image");
    expect(figure.firstChild?.attrs.src).toBeNull();
    expect(figure.lastChild?.type.name).toBe("figcaption");
    expect(figure.lastChild?.textContent).toBe(caption);
  },
);

test("bare shortcuts retain defaults and a default image caption is valid", () => {
  expect(matchFigureTable("tab")).toEqual({ cols: 3, rows: 3, caption: "" });
  expect(matchFigureTable("tab.")).toEqual({ cols: 3, rows: 3, caption: "" });
  expect(matchFigureImage("fig")).toBe(true);
  const figure = schema.nodeFromJSON(createFigureImage());
  figure.check();
  expect(figure.lastChild?.textContent).toBe("Image Caption");
});

test("an existing image source survives wrapping in a figure", () => {
  const figure = schema.nodeFromJSON(createFigureImage("stored-image"));
  figure.check();
  expect(figure.firstChild?.attrs.src).toBe("stored-image");
});
