import { Extension } from "@tiptap/core";
import { CutClipboard } from "./cut-clipboard";

export const ChapterClipboard = Extension.create({
  name: "chapterClipboard",
  priority: 1000,
  addProseMirrorPlugins() { return [new CutClipboard().plugin]; },
});
