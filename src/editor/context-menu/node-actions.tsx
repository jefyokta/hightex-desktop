import type { Editor } from "@tiptap/core";
import type { ContextMenuAction } from "@/hooks/use-context-menu";
import { t } from "@/utils/lang";
import { Image as ImageIcon, Sigma, Trash2 } from "lucide-react";
import { unwrapImageFigure } from "../extensions/image-figure/unwrap";
import type { EditorContextTarget } from "./target";

export function nodeContextActions(
  editor: Editor,
  target: EditorContextTarget,
): ContextMenuAction[] {
  return [
    ...imageActions(editor, target),
    ...figureTableActions(editor),
    ...mathActions(editor),
  ];
}

const imageActions = (
  editor: Editor,
  target: EditorContextTarget,
): ContextMenuAction[] => {
  const figure = target.find("imageFigure");
  if (figure) {
    return [{
      label: t("editor.inline.unwrap_figure"),
      icon: <ImageIcon className="h-4 w-4" />,
      onClick: () => {
        const transaction = unwrapImageFigure(editor.state, figure.position);
        if (transaction) editor.view.dispatch(transaction);
      },
    }];
  }

  if (target.node.type.name === "image") {
    return [
      {
        label: t("editor.context_menu.delete_image"),
        icon: <Trash2 className="h-4 w-4" />,
        danger: true,
        onClick: () => target.delete(editor),
      },
    ];
  }

  return [];
};

const figureTableActions = (editor: Editor): ContextMenuAction[] => {
  if (editor.isActive("figureTable")) {
    return [
      {
        label: t("editor.context_menu.delete_figure_table"),
        icon: <Trash2 className="h-4 w-4" />,
        danger: true,
        onClick: () => editor.commands.deleteNode("figureTable"),
      },
    ];
  }

  return [];
};

const mathActions = (editor: Editor): ContextMenuAction[] => {
  if (editor.isActive("mathBlock") || editor.isActive("mathInline")) {
    return [
      {
        label: t("editor.context_menu.delete_math"),
        icon: <Sigma className="h-4 w-4" />,
        danger: true,
        onClick: () => editor.commands.deleteSelection(),
      },
    ];
  }

  return [];
};
