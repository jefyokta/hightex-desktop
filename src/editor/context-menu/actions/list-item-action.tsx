import { CornerUpLeft, CornerUpRight, List, ListOrdered } from "lucide-react";
import { t } from "@/utils/lang";
import type { ContextMenuContext, NodeActionItem } from "../contracts";
import { NodeAction } from "../node-action";

export class ListItemAction extends NodeAction {
  protected readonly nodeType = "listItem";

  public items({ editor }: ContextMenuContext): NodeActionItem[] {
    return [
      {
        label: t("editor.context_menu.outdent_item"),
        icon: <CornerUpLeft className="size-4" />,
        disabled: !editor.can().liftListItem(this.nodeType),
        onClick: () => editor.chain().focus().liftListItem(this.nodeType).run(),
      },
      {
        label: t("editor.context_menu.indent_item"),
        icon: <CornerUpRight className="size-4" />,
        disabled: !editor.can().sinkListItem(this.nodeType),
        onClick: () => editor.chain().focus().sinkListItem(this.nodeType).run(),
      },
      {
        label: t("editor.context_menu.toggle_bullet_list"),
        icon: <List className="size-4" />,
        onClick: () => editor.chain().focus().toggleBulletList().run(),
      },
      {
        label: t("editor.context_menu.toggle_ordered_list"),
        icon: <ListOrdered className="size-4" />,
        onClick: () => editor.chain().focus().toggleOrderedList().run(),
      },
    ];
  }
}
