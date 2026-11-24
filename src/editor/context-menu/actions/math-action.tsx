import { Sigma } from "lucide-react";
import { t } from "@/utils/lang";
import type { ContextMenuContext, NodeActionItem } from "../contracts";
import { NodeAction } from "../node-action";

export abstract class MathAction extends NodeAction {
  public supports({ target }: ContextMenuContext): boolean {
    return target.node.type.name === this.nodeType;
  }

  public items({ editor }: ContextMenuContext): NodeActionItem[] {
    return [{
      key: "delete-node",
      label: t("editor.context_menu.delete_math"),
      icon: <Sigma className="size-4" />,
      danger: true,
      onClick: () => editor.commands.deleteSelection(),
    }];
  }
}
