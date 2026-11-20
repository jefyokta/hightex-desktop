import { ListItem as TipTapListItem } from "@tiptap/extension-list";

import { mergeAttributes } from "@tiptap/core";
import { chapterContentNodeView } from "@/editor/chapter/content-node-view";
import { ListItemComponent } from "./list-item";

export const ListItem = TipTapListItem.extend({
  renderHTML({ HTMLAttributes }) {
    return [
      "li",
      mergeAttributes(HTMLAttributes, {
        class: "relative group overflow-visible",
        style: "white-space:inherit",
      }),
      ["div", { style: "white-space:inherit" }, 0],
    ];
  },
  addNodeView() {
    return chapterContentNodeView(ListItemComponent);
  },
});
