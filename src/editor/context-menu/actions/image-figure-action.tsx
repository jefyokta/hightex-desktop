import { Image as ImageIcon } from "lucide-react";
import { unwrapImageFigure } from "../../extensions/image-figure/unwrap";
import { t } from "@/utils/lang";
import type { ContextMenuContext, NodeActionItem } from "../contracts";
import { NodeAction } from "../node-action";

export class ImageFigureAction extends NodeAction {
  protected readonly nodeType = "imageFigure";

  public supports({ target }: ContextMenuContext): boolean {
    return target.find(this.nodeType) !== null;
  }

  public items({ editor, target }: ContextMenuContext): NodeActionItem[] {
    const figure = target.find(this.nodeType)!;
    return [{
      label: t("editor.inline.unwrap_figure"),
      icon: <ImageIcon className="size-4" />,
      onClick: () => {
        const transaction = unwrapImageFigure(editor.state, figure.position);
        if (transaction) editor.view.dispatch(transaction);
      },
    }];
  }
}
