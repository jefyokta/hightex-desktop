import { expect, test } from "bun:test";
import type { Document } from "../src/editor/document";
import { createSnapshot } from "../src/scanner/snapshot";
import { runScan } from "@hightex/scanner";

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
  expect(snapshot.chapters[0]).toEqual({ id: "doc.1", title: "Live chapter" });
  expect(report.results.punctuation).toHaveLength(1);
  expect(report.results["unreferenced-figures"]?.images[0]).toMatchObject({
    id: "new-figure",
    chapterId: "doc.1",
    numbering: "1.1",
    path: [1],
  });
});
