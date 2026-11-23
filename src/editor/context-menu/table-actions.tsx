import type { Editor } from "@tiptap/core";
import type { ContextMenuAction } from "@/hooks/use-context-menu";
import { t } from "@/utils/lang";
import {
  AlignCenter, AlignLeft, AlignRight, Grid2x2X, Merge, Plus, Split, Wrench,
} from "lucide-react";

export function tableContextActions(editor: Editor): ContextMenuAction[] {
  const grid = editor.isActive("grid");
  const inCell = grid
    ? editor.isActive("gridCell") || editor.isActive("gridRow")
    : editor.isActive("tableCell") || editor.isActive("tableRow");
  const deleteTable: ContextMenuAction = {
    label: t("editor.context_menu.delete_grid"),
    icon: <Grid2x2X className="size-4" />,
    danger: true,
    onClick: () => grid
      ? editor.commands.deleteNode("grid")
      : editor.commands.deleteTable(),
  };
  if (!inCell) return grid ? [deleteTable] : [];

  return [
    {
      label: t("editor.context_menu.split_cell"),
      icon: <Split className="size-4" />,
      onClick: () => editor.commands.splitCell(),
      disabled: !editor.can().splitCell(),
    },
    {
      label: t("editor.context_menu.align_left"),
      icon: <AlignLeft className="size-4" />,
      onClick: () => editor.commands.setCellAlignmentLeft(),
    },
    {
      label: t("editor.context_menu.align_center"),
      icon: <AlignCenter className="size-4" />,
      onClick: () => editor.commands.setCellAlignmentCenter(),
    },
    {
      label: t("editor.context_menu.align_right"),
      icon: <AlignRight className="size-4" />,
      onClick: () => editor.commands.setCellAlignmentRight(),
    },
    {
      label: t("editor.context_menu.merge_cells"),
      icon: <Merge className="size-4" />,
      onClick: () => editor.commands.mergeCells(),
      disabled: !editor.can().mergeCells(),
    },
    {
      label: t("editor.context_menu.add_row_after"),
      icon: <Plus className="size-4" />,
      onClick: () => editor.chain().addRowAfter().run(),
    },
    {
      label: t("editor.context_menu.add_column_after"),
      icon: <Plus className="size-4" />,
      onClick: () => editor.chain().addColumnAfter().run(),
    },
    {
      label: t("editor.context_menu.delete_row"),
      icon: <Grid2x2X className="size-4" />,
      danger: true,
      onClick: () => editor.commands.deleteRow(),
    },
    ...(!grid ? [{
      label: t("editor.context_menu.fix_table"),
      icon: <Wrench className="size-4" />,
      onClick: () => editor.commands.fixTables(),
    }] : []),
    {
      label: t("editor.context_menu.delete_column"),
      icon: <Grid2x2X className="size-4" />,
      danger: true,
      onClick: () => editor.commands.deleteColumn(),
    },
    ...(grid || !editor.isActive("figureTable") ? [deleteTable] : []),
  ];
}
