import type { ContextMenuContext, NodeActionItem } from "../contracts";
import { NodeAction } from "../node-action";
import { t } from "@/utils/lang";
import {
  AlignCenter, AlignLeft, AlignRight, Columns3, Grid2x2X, Merge, Plus, Split, Wrench,
} from "lucide-react";

export class TableAction extends NodeAction {
  protected readonly nodeType = "table";

  public items({ editor, target }: ContextMenuContext): NodeActionItem[] {
    const inCell = editor.isActive("tableCell") || editor.isActive("tableRow");
    const deleteTable: NodeActionItem = {
      key: "delete-node",
      label: t("editor.context_menu.delete_grid"),
      icon: <Grid2x2X className="size-4" />,
      danger: true,
      onClick: () => editor.commands.deleteTable(),
    };
    if (!inCell) return [deleteTable];
    const cell = [target.find("tableCell"), target.find("tableHeader")]
      .filter((candidate) => candidate !== null)
      .sort((left, right) => right.position - left.position)[0];

    return [
      ...(cell ? [{
        label: t("editor.context_menu.apply_cell_width_to_all"),
        icon: <Columns3 className="size-4" />,
        onClick: () => editor.commands.applyCellWidthToTable(cell.position),
        disabled: !editor.can().applyCellWidthToTable(cell.position),
      }] : []),
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
      {
        label: t("editor.context_menu.fix_table"),
        icon: <Wrench className="size-4" />,
        onClick: () => editor.commands.fixTables(),
      },
      {
        label: t("editor.context_menu.delete_column"),
        icon: <Grid2x2X className="size-4" />,
        danger: true,
        onClick: () => editor.commands.deleteColumn(),
      },
      ...(!editor.isActive("figureTable") ? [deleteTable] : []),
    ];
  }
}
