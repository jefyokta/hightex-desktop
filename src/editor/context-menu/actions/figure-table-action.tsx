import { Trash2 } from "lucide-react";
import { t } from "@/utils/lang";
import type { ContextMenuContext, NodeActionItem } from "../contracts";
import { NodeAction } from "../node-action";

export class FigureTableAction extends NodeAction {
  protected readonly nodeType = "figureTable";

  public items({ editor }: ContextMenuContext): NodeActionItem[] {
    return [{
      key: "delete-node",
      label: t("editor.context_menu.delete_figure_table"),
      icon: <Trash2 className="size-4" />,
      danger: true,
      onClick: () => editor.commands.deleteNode(this.nodeType),
    }];
  }
}
