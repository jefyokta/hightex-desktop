import { ContextMenuAction } from "@/hooks/use-context-menu";
import { t } from "@/utils/lang";
import { Editor } from "@tiptap/core";
import {
  Merge,
  Split,
  Plus,
  Grid2x2X,
  Heading2,
  Heading3,
  Heading4,
  Type,
  List,
  ListOrdered,
  CornerUpLeft,
  CornerUpRight,
  Quote,
  Sigma,
  Trash2,
  AlignCenter,
  AlignLeft,
  AlignRight,
  Wrench,
} from "lucide-react";

export const getContextMenuItems = (editor: Editor): ContextMenuAction[] => {
  return [
    ...TableContextMenuItems(editor),
    ...HeadingContextMenuItems(editor),
    ...ListContextMenuItems(editor),
    ...ImageContextMenuItems(editor),
    ...FigureTableContextMenuItems(editor),
    ...MathContextMenuItems(editor),
    ...BlockquoteContextMenuItems(editor),
    ...GridContextMenuItems(editor),
  ];
};

const GridContextMenuItems = (editor: Editor): ContextMenuAction[] => {
  if (editor.isActive("gridCell") || editor.isActive("gridRow")) {
    return [
      {
        label: t("editor.context_menu.split_cell"),
        icon: <Split className="h-4 w-4" />,
        onClick: () => editor.commands.splitCell(),
        disabled: !editor.can().splitCell(),
      },
      {
        label: t("editor.context_menu.align_left"),
        icon: <AlignLeft />,
        onClick: () => editor.commands.setCellAlignmentLeft(),
      },
      {
        label: t("editor.context_menu.align_center"),
        icon: <AlignCenter />,
        onClick: () => editor.commands.setCellAlignmentCenter(),
      },
      {
        label: t("editor.context_menu.align_right"),
        icon: <AlignRight />,
        onClick: () => editor.commands.setCellAlignmentRight(),
      },
      {
        label: t("editor.context_menu.merge_cells"),
        icon: <Merge className="h-4 w-4" />,
        onClick: () => editor.commands.mergeCells(),
        disabled: !editor.can().mergeCells(),
      },
      {
        label: t("editor.context_menu.add_row_after"),
        icon: <Plus className="h-4 w-4" />,
        onClick: () => editor.chain().addRowAfter().run(),
      },
      {
        label: t("editor.context_menu.add_column_after"),
        icon: <Plus className="h-4 w-4" />,
        onClick: () => editor.chain().addColumnAfter().run(),
      },
      {
        label: t("editor.context_menu.delete_row"),
        danger: true,
        icon: <Grid2x2X className="h-4 w-4" />,
        onClick: () => editor.commands.deleteRow(),
      },
      {
        label: t("editor.context_menu.delete_column"),
        danger: true,
        icon: <Grid2x2X className="h-4 w-4" />,
        onClick: () => editor.commands.deleteColumn(),
      },
      {
        label: t("editor.context_menu.delete_grid"),
        danger: true,
        icon: <Grid2x2X className="h-4 w-4" />,
        onClick: () => editor.commands.deleteNode("grid"),
      },
    ];
  }

  if (editor.isActive("grid")) {
    return [
      {
        label: t("editor.context_menu.delete_grid"),
        danger: true,
        icon: <Grid2x2X className="h-4 w-4" />,
        onClick: () => editor.commands.deleteNode("grid"),
      },
    ];
  }

  return [];
};

const TableContextMenuItems = (editor: Editor): ContextMenuAction[] => {
  if (editor.isActive("tableCell") || editor.isActive("tableRow")) {
    return [
      {
        label: t("editor.context_menu.split_cell"),
        icon: <Split className="h-4 w-4" />,
        onClick: () => editor.commands.splitCell(),
        disabled: !editor.can().splitCell(),
      },
      {
        label: t("editor.context_menu.align_left"),
        icon: <AlignLeft />,
        onClick: () => editor.commands.setCellAlignmentLeft(),
      },
      {
        label: t("editor.context_menu.align_center"),
        icon: <AlignCenter />,
        onClick: () => editor.commands.setCellAlignmentCenter(),
      },
      {
        label: t("editor.context_menu.align_right"),
        icon: <AlignRight />,
        onClick: () => editor.commands.setCellAlignmentRight(),
      },
      {
        label: t("editor.context_menu.merge_cells"),
        icon: <Merge className="h-4 w-4" />,
        onClick: () => editor.commands.mergeCells(),
        disabled: !editor.can().mergeCells(),
      },
      {
        label: t("editor.context_menu.add_row_after"),
        icon: <Plus className="h-4 w-4" />,
        onClick: () => editor.chain().addRowAfter().run(),
      },
      {
        label: t("editor.context_menu.add_column_after"),
        icon: <Plus className="h-4 w-4" />,
        onClick: () => editor.chain().addColumnAfter().run(),
      },
      {
        label: t("editor.context_menu.delete_row"),
        danger: true,
        icon: <Grid2x2X className="h-4 w-4" />,
        onClick: () => editor.commands.deleteRow(),
      },
      {
        label: t("editor.context_menu.fix_table"),
        icon: <Wrench />,
        onClick: () => editor.commands.fixTables(),
      },
      {
        label: t("editor.context_menu.delete_column"),
        danger: true,
        icon: <Grid2x2X className="h-4 w-4" />,
        onClick: () => editor.commands.deleteColumn(),
      },
      ...(!editor.isActive("figureTable")
        ? [
            {
              label: t("editor.context_menu.delete_grid"),
              danger: true,
              icon: <Grid2x2X className="h-4 w-4" />,
              onClick: () => editor.commands.deleteTable(),
            },
          ]
        : []),
    ];
  }

  return [];
};

const HeadingContextMenuItems = (editor: Editor): ContextMenuAction[] => {
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

const ListContextMenuItems = (editor: Editor): ContextMenuAction[] => {
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

const ImageContextMenuItems = (editor: Editor): ContextMenuAction[] => {
  if (editor.isActive("image")) {
    return [
      {
        label: t("editor.context_menu.delete_image"),
        icon: <Trash2 className="h-4 w-4" />,
        danger: true,
        onClick: () => editor.commands.deleteSelection(),
      },
    ];
  }

  return [];
};

const FigureTableContextMenuItems = (editor: Editor): ContextMenuAction[] => {
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

const MathContextMenuItems = (editor: Editor): ContextMenuAction[] => {
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

const BlockquoteContextMenuItems = (editor: Editor): ContextMenuAction[] => {
  if (editor.isActive("blockquote")) {
    return [
      {
        label: t("editor.context_menu.remove_quote"),
        icon: <Quote className="h-4 w-4" />,
        onClick: () => editor.chain().focus().toggleBlockquote().run(),
      },
    ];
  }

  return [];
};
