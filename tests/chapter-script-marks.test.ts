import { expect, test } from "bun:test";
import { getSchema } from "@tiptap/core";
import { ChapterExtensions } from "../src/editor/chapter/chapter-extensions";
import { chapterSnapshotSource } from "../src/editor/chapter/snapshot-source";

test.each(["1", "attachment", "abstract", "abstract-en", "foreword", "presentation"])(
  "%s preserves subscript and superscript in the live and snapshot schemas",
  chapterName => {
    const live = getSchema(new ChapterExtensions({
      frozen: false,
      title: "Chapter",
      getChapter: () => chapterName,
      query: { isNormalChapter: () => chapterName === "1" },
    }).get());
    const snapshot = getSchema(ChapterExtensions.contentSchema(chapterName));
    const paragraph = {
      type: "paragraph",
      attrs: { id: "script-marks" },
      content: [
        { type: "text", text: "H" },
        { type: "text", text: "2", marks: [{ type: "subscript" }] },
        { type: "text", text: "O + x" },
        { type: "text", text: "2", marks: [{ type: "superscript" }, { type: "italic" }] },
      ],
    };
    const before = JSON.stringify(paragraph);
    const source = live.nodeFromJSON({ type: "doc", content: [paragraph] });
    const captured = chapterSnapshotSource(snapshot, [paragraph], `fixture.${chapterName}`);

    source.check();
    expect(captured.toJSON()).toEqual(source.toJSON());
    expect(captured.firstChild?.child(1).marks.map(mark => mark.type.name)).toEqual(["subscript"]);
    expect(captured.firstChild?.child(3).marks.map(mark => mark.type.name).sort()).toEqual(["italic", "superscript"]);
    expect(JSON.stringify(paragraph)).toBe(before);
  },
);
