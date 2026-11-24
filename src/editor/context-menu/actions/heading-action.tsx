import { Heading2, Heading3, Heading4, Type } from "lucide-react";
import { t } from "@/utils/lang";
import type { ContextMenuContext, NodeActionItem } from "../contracts";
import { NodeAction } from "../node-action";

export class HeadingAction extends NodeAction {
  protected readonly nodeType = "heading";

  public items({ editor }: ContextMenuContext): NodeActionItem[] {
    return [
      {
        label: t("editor.context_menu.paragraph"),
        icon: <Type className="size-4" />,
        onClick: () => editor.chain().focus().setParagraph().run(),
      },
      {
        label: t("editor.context_menu.heading_2"),
        icon: <Heading2 className="size-4" />,
        onClick: () => editor.chain().focus().setHeading({ level: 2 }).run(),
      },
      {
        label: t("editor.context_menu.heading_3"),
        icon: <Heading3 className="size-4" />,
        onClick: () => editor.chain().focus().setHeading({ level: 3 }).run(),
      },
      {
        label: t("editor.context_menu.heading_4"),
        icon: <Heading4 className="size-4" />,
        onClick: () => editor.chain().focus().setHeading({ level: 4 }).run(),
      },
    ];
  }
}
