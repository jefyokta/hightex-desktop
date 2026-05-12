import { ListItem as TipTapListItem } from "@tiptap/extension-list";

import { ReactNodeViewRenderer } from "@tiptap/react";
import { ListItemComponent } from "./list-item";

export const ListItem = TipTapListItem.extend({
  addNodeView() {
    return ReactNodeViewRenderer(ListItemComponent);
  },
});
