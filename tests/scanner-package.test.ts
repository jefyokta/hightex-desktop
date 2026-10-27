import { expect, test } from "bun:test";
import type { Document } from "../src/editor/document";
import type { JSONContent } from "@tiptap/core";
import { createSnapshot } from "../src/scanner/snapshot";
import { runScan } from "@hightex/scanner";

function documentWithContent(content: JSONContent[]): Document {
  return {
    chapters: [
      {
        frozen: false,
        title: "Inline nodes",
        getId: () => "doc.1",
        getChapter: () => "1",
        query: { isAttachmentChapter: () => false },
        getContent: async () => content,
      },
    ],
  } as unknown as Document;
}

test("desktop scanner delegates to the local library and builds graphs from live content", async () => {
  const source = {
    chapters: [
      {
        frozen: false,
        title: "Live chapter",
        getId: () => "doc.1",
        getChapter: () => "1",
        query: { isAttachmentChapter: () => false },
        getContent: async () => [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Live  content" }],
          },
          { type: "imageFigure", attrs: { id: "new-figure" }, content: [] },
        ],
      },
    ],
    getImages: () => {
      throw new Error("Must not use cached graphs");
    },
  } as unknown as Document;
  const snapshot = await createSnapshot(source);
  const report = await runScan(snapshot);
  expect(snapshot.chapters[0]).toEqual({
    id: "doc.1",
    title: "Live chapter",
    attachment: false,
  });
  expect(report.results.punctuation).toHaveLength(1);
  expect(report.results["unreferenced-figures"]?.images[0]).toMatchObject({
    id: "new-figure",
    chapterId: "doc.1",
    numbering: "1.1",
    path: [1],
  });
});

test.each(["refComponent", "cite", "variable", "mathInline", "dots"])(
  "%s occupies space in scanner text without creating punctuation warnings",
  async (type) => {
    const content: JSONContent[] = [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Pada " },
          { type, content: [] },
          { type: "text", text: ", berikutnya." },
        ],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Lihat " },
          { type },
          { type: "text", text: " berikut." },
        ],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Satu," },
          { type },
          { type: "text", text: ", dua." },
        ],
      },
    ];
    const snapshot = await createSnapshot(documentWithContent(content));
    const report = await runScan(snapshot);
    expect(report.complete).toBe(true);
    expect(report.results.punctuation).toEqual([]);
  },
);

test("inline placeholders preserve real warnings, excerpts, references and source content", async () => {
  const content: JSONContent[] = [
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "Pada  " },
                {
                  type: "refComponent",
                  attrs: { ref: "imageFigure", link: "figure-1" },
                },
                { type: "text", text: " , lanjut." },
              ],
            },
          ],
        },
      ],
    },
    { type: "imageFigure", attrs: { id: "figure-1" }, content: [] },
  ];
  const original = structuredClone(content);
  const snapshot = await createSnapshot(documentWithContent(content));
  const report = await runScan(snapshot);
  expect(report.complete).toBe(true);
  expect(report.results.punctuation).toEqual([
    expect.objectContaining({
      paragraph: 1,
      message: "Spasi ganda",
      excerpt: {
        before: "Pada",
        match: "  ",
        after: "<node:refComponent> , lanjut.",
      },
    }),
    expect.objectContaining({
      paragraph: 1,
      message: 'Ada spasi sebelum tanda baca ","',
      excerpt: {
        before: "Pada  <node:refComponent>",
        match: " ,",
        after: " lanjut.",
      },
    }),
  ]);
  expect(report.results["unreferenced-figures"]?.images).toEqual([]);
  expect(snapshot.images[0]).toMatchObject({ id: "figure-1", path: [1] });
  expect(content).toEqual(original);
});

test("scanner 0.2 retains attachment graphs but reports only unreferenced attachment headings", async () => {
  const normal: JSONContent[] = [
    { type: "imageFigure", attrs: { id: "normal-image" } },
    { type: "figureTable", attrs: { id: "normal-table" } },
    { type: "blockMath", attrs: { id: "normal-equation" } },
    {
      type: "paragraph",
      content: [
        { type: "refComponent", attrs: { ref: "head", link: "attachment-a" } },
      ],
    },
  ];
  const attachment: JSONContent[] = [
    {
      type: "heading",
      attrs: { id: "attachment-a", level: 1 },
      content: [{ type: "text", text: "Referred appendix" }],
    },
    { type: "imageFigure", attrs: { id: "attachment-image" } },
    { type: "figureTable", attrs: { id: "attachment-table" } },
    { type: "blockMath", attrs: { id: "attachment-equation" } },
    {
      type: "heading",
      attrs: { level: 1 },
      content: [{ type: "text", text: "Unreferenced appendix" }],
    },
    {
      type: "paragraph",
      content: [
        {
          type: "refComponent",
          attrs: { ref: "imageFigure", link: "normal-image" },
        },
        {
          type: "refComponent",
          attrs: { ref: "figureTable", link: "normal-table" },
        },
        {
          type: "refComponent",
          attrs: { ref: "equation", link: "normal-equation" },
        },
      ],
    },
  ];
  const original = structuredClone({ normal, attachment });
  const source = {
    chapters: [
      {
        frozen: false,
        title: "Normal",
        getId: () => "doc.1",
        getChapter: () => "1",
        query: { isAttachmentChapter: () => false },
        getContent: async () => normal,
      },
      {
        frozen: false,
        title: "Appendices",
        getId: () => "doc.attachment",
        getChapter: () => "attachment",
        query: { isAttachmentChapter: () => true },
        getContent: async () => attachment,
      },
    ],
  } as unknown as Document;
  const snapshot = await createSnapshot(source);
  const report = await runScan(snapshot);
  expect(report.scannerVersion).toBe("0.2.0");
  expect(snapshot.chapters[1].attachment).toBe(true);
  expect(
    snapshot.images.find((image) => image.id === "attachment-image")?.numbering,
  ).toBe("A.1");
  expect(
    snapshot.equations.find((equation) => equation.id === "attachment-equation")
      ?.numbering,
  ).toBe("2");
  expect(report.results["unreferenced-figures"]).toEqual({
    images: [],
    tables: [],
    equations: [],
    headings: [
      {
        id: "",
        chapterId: "doc.attachment",
        text: [{ type: "text", text: "Unreferenced appendix" }],
        pos: 2,
        numbering: "2",
        path: [4],
        level: 1,
      },
    ],
  });
  expect(report.diagnostics).toContainEqual({
    pluginId: "unreferenced-figures",
    code: "unreferenced_figure",
    severity: "warning",
    chapterId: "doc.attachment",
    path: [4],
    message: "Lampiran B belum dirujuk dalam teks",
  });
  expect({ normal, attachment }).toEqual(original);
});
