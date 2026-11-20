import type { Editor } from "@tiptap/core";
import { Manager } from "@/editor/manager";

export const HEADING_PATH_PREFIX = "outline:heading:";

/** Unvisited source headings may not have an authored ID until editor hydration. */
export const headingNavigationTarget = (heading: HeadingGraph): string =>
  heading.id || HEADING_PATH_PREFIX + JSON.stringify(heading.path);

/** Resolve the recorded source path against hydrated content, without writing IDs. */
export function scrollToHeadingPath(editor: Editor, target: string): void {
  const path: number[] = JSON.parse(target.slice(HEADING_PATH_PREFIX.length));
  let node = editor.state.doc;
  for (const index of path) {
    if (index < 0 || index >= node.childCount) return;
    node = node.child(index);
  }
  if (node.type.name === "heading" && node.attrs.id) Manager.scrollTo(node.attrs.id);
}
