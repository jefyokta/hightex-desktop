import { Trash2 } from "lucide-react";
import { t } from "@/utils/lang";
import type { ContextMenuContext, NodeActionItem } from "../contracts";
import { NodeAction } from "../node-action";

export class ImageAction extends NodeAction {
  protected readonly nodeType = "image";

  public supports({ target }: ContextMenuContext): boolean {
    return target.node.type.name === this.nodeType && !target.find("imageFigure");
  }

  public items({ editor, target }: ContextMenuContext): NodeActionItem[] {
    return [{
      key: "delete-node",
      label: t("editor.context_menu.delete_image"),
      icon: <Trash2 className="size-4" />,
      danger: true,
      onClick: () => target.delete(editor),
    }];
  }
}
