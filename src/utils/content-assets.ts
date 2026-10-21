import type { JSONContent } from "@tiptap/core";

export const contentAssets = (chapters: HighTexChapter[]) => {
  const images = new Set<string>();
  const references = new Set<string>();
  const visit = (node: JSONContent) => {
    if (node.type === "image" && typeof node.attrs?.src === "string")
      images.add(node.attrs.src);
    if (node.type === "cite" && typeof node.attrs?.cite === "string")
      node.attrs.cite
        .split("|")
        .filter(Boolean)
        .forEach((key) => references.add(key));
    node.content?.forEach(visit);
  };
  chapters.forEach((chapter) => chapter.content.forEach(visit));
  return { images, references };
};
