import { expect, test } from "bun:test";
import { loadSource, loadIPCModule } from "./helpers/load-source";
import type { JSONContent } from "@tiptap/core";

function fixture() {
  const saved: HighTexChapter[] = [];
  const { ChapterQuery } = loadSource<
    typeof import("../src/editor/chapter/chapter-query")
  >(new URL("../src/editor/chapter/chapter-query.ts", import.meta.url), {
    "../storage/hightex-db": { HighTexDB: {} },
    "@/hooks/use-ipc": loadIPCModule(),
  });
  const { Chapter } = loadSource<
    typeof import("../src/editor/chapter/chapter")
  >(new URL("../src/editor/chapter/chapter.ts", import.meta.url), {
    "../storage": {
      Storage: {
        instance: {
          setChapter: async (chapter: HighTexChapter) => saved.push(chapter),
        },
      },
    },
    "./chapter-extensions": { ChapterExtensions: class {} },
    "./chapter-graph": {
      ChapterGraph: class {
        extract() {}
      },
    },
    "./chapter-query": { ChapterQuery },
    "../manager": { Manager: { app: { dispatch() {} } } },
    "../document": { Document: class {} },
    "@/hooks/use-chapter": { useChapterStore: {} },
    "@/components/editor/decorator/abstract": {},
    react: {},
  });
  return { Chapter, saved };
}

test("saving editor source preserves its first heading anchor and demotes later H1s", async () => {
  const { Chapter, saved } = fixture();
  const chapter = new Chapter({
    documentId: "doc",
    chapter: "2",
    isolated: true,
  }).setTitle("Second");
  const nodes: JSONContent[] = [
    {
      type: "heading",
      attrs: { level: 1, id: "stable-chapter-anchor" },
      content: [{ type: "text", text: "Second" }],
    },
    {
      type: "paragraph",
      attrs: { id: "stable-body" },
      content: [{ type: "text", text: "Authored source" }],
    },
    {
      type: "heading",
      attrs: { level: 1, id: "stable-section-anchor" },
      content: [{ type: "text", text: "Section" }],
    },
  ];
  const before = JSON.stringify(nodes);
  await chapter.setContent(nodes);
  expect(saved[0].content[0]).toEqual(nodes[0]);
  expect(saved[0].content[1]).toEqual(nodes[1]);
  expect(saved[0].content[2].attrs).toEqual({
    level: 2,
    id: "stable-section-anchor",
  });
  expect(JSON.stringify(nodes)).toBe(before);
  expect(chapter.sourceContent(saved[0].content)).toEqual(saved[0].content);
});
