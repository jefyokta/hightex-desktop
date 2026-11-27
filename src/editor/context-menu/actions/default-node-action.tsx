import { TextSelection } from "@tiptap/pm/state";
import { Trash2 } from "lucide-react";
import { t } from "@/utils/lang";
import type { ContextMenuContext, NodeActionItem } from "../contracts";
import { NodeAction } from "../node-action";

export class DefaultNodeAction extends NodeAction {
  protected readonly nodeType = null;

  public items({ editor, target }: ContextMenuContext): NodeActionItem[] {
    return [{
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
    }];
  }
}
