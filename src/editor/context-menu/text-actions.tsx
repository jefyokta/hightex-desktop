import type { Editor } from "@tiptap/core";
import type { ContextMenuAction } from "@/hooks/use-context-menu";
import { t } from "@/utils/lang";
import {
  Heading2, Heading3, Heading4, Type, List, ListOrdered,
  CornerUpLeft, CornerUpRight,
} from "lucide-react";

export function textContextActions(editor: Editor): ContextMenuAction[] {
  return [...headingActions(editor), ...listActions(editor)];
}

const headingActions = (editor: Editor): ContextMenuAction[] => {
  if (editor.isActive("heading")) {
    return [
      {
        label: t("editor.context_menu.paragraph"),
        icon: <Type className="h-4 w-4" />,
        onClick: () => editor.chain().focus().setParagraph().run(),
      },
      {
        label: t("editor.context_menu.heading_2"),
        icon: <Heading2 className="h-4 w-4" />,
        onClick: () => editor.chain().focus().setHeading({ level: 2 }).run(),
      },
      {
        label: t("editor.context_menu.heading_3"),
        icon: <Heading3 className="h-4 w-4" />,
        onClick: () => editor.chain().focus().setHeading({ level: 3 }).run(),
      },
      {
        label: t("editor.context_menu.heading_4"),
        icon: <Heading4 className="h-4 w-4" />,
        onClick: () => editor.chain().focus().setHeading({ level: 4 }).run(),
      },
    ];
  }

  return [];
};

const listActions = (editor: Editor): ContextMenuAction[] => {
  if (
    editor.isActive("bulletList") ||
    editor.isActive("orderedList") ||
    editor.isActive("listItem")
  ) {
    return [
      {
        label: t("editor.context_menu.outdent_item"),
        icon: <CornerUpLeft className="h-4 w-4" />,
        disabled: !editor.can().liftListItem("listItem"),
        onClick: () => editor.chain().focus().liftListItem("listItem").run(),
      },
      {
        label: t("editor.context_menu.indent_item"),
        icon: <CornerUpRight className="h-4 w-4" />,
        disabled: !editor.can().sinkListItem("listItem"),
        onClick: () => editor.chain().focus().sinkListItem("listItem").run(),
      },
      {
        label: t("editor.context_menu.toggle_bullet_list"),
        icon: <List className="h-4 w-4" />,
        onClick: () => editor.chain().focus().toggleBulletList().run(),
      },
      {
        label: t("editor.context_menu.toggle_ordered_list"),
        icon: <ListOrdered className="h-4 w-4" />,
        onClick: () => editor.chain().focus().toggleOrderedList().run(),
      },
    ];
  }

  return [];
};

