import { JSONContent } from "@tiptap/core";

export function createFigureTable(
  rowCount = 3,
  columnCount = 3,
  caption?: string,
): JSONContent {
  const content: JSONContent[] = [];

  content.push(createFigcaption(caption));

  content.push(createTable(rowCount, columnCount));

  return {
    type: "figureTable",
    content,
  };
}

function createFigcaption(text?: string): JSONContent {
  return {
    type: "figcaption",
    content: [{ type: "text", text }],
  };
}

function createTable(rowCount: number, columnCount: number): JSONContent {
  return {
    type: "table",
    content: Array.from({ length: rowCount }, (_, rowIndex) =>
      createRow(columnCount, rowIndex === 0),
    ),
  };
}

function createRow(columnCount: number, isHeader = false): JSONContent {
  return {
    type: "tableRow",
    content: Array.from({ length: columnCount }, () => createCell(isHeader)),
  };
}

function createCell(isHeader = false): JSONContent {
  return {
    type: isHeader ? "tableHeader" : "tableCell",
    content: [
      {
        type: "paragraph",
      },
    ],
  };
}
