import { TextSelection } from "@tiptap/pm/state";
import { Eye, Trash2 } from "lucide-react";
import { t } from "@/utils/lang";
import type { ContextMenuContext, NodeActionItem } from "../contracts";
import { NodeAction } from "../node-action";

export class DefaultNodeAction extends NodeAction {
  protected readonly nodeType = null;

  public items({ editor, target, preview }: ContextMenuContext): NodeActionItem[] {
    const items: NodeActionItem[] = [];
    const id = target.node.attrs.id;
    if (id && preview)
      items.push({
        key: "preview-node",
        label: t("editor.context_menu.see_in_preview"),
        icon: <Eye className="size-4" />,
        onClick: () => preview(id),
      });
    items.push({
      key: "delete-node",
      label: t("editor.context_menu.delete"),
      icon: <Trash2 className="size-4" />,
      danger: true,
      onClick: () => {
        const { selection } = editor.state;
        if (selection instanceof TextSelection && !selection.empty)
          editor.commands.deleteSelection();
        else target.delete(editor);
      },
    });
    return items;
  }
}
