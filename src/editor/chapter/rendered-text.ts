import type { EditorView } from "@tiptap/pm/view";
import { citationElement } from "../extensions/citation/status";

/** Authored text plus the resolved visible labels of supported inline atoms. */
export function chapterRenderedText(
  view: Pick<EditorView, "state" | "nodeDOM">,
  from: number,
  to: number,
): string {
  let text = "";
  view.state.doc.nodesBetween(from, to, (node, position) => {
    if (node.isText)
      text += node.text!.slice(Math.max(0, from - position), to - position);
    else if (node.type.name === "cite") {
      const citation = citationElement(view, position);
      if (!citation?.textContent) throw Error("Missing resolved citation text");
      text += citation.textContent;
    } else if (node.isLeaf && node.isAtom) {
      text += view.nodeDOM(position)?.textContent ?? "";
    }
  });
  return text;
}
