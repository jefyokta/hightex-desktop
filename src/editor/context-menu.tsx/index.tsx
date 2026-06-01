import { ContextMenuAction } from "@/hooks/use-context-menu";
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
  ];
};

const TableContextMenuItems = (editor: Editor): ContextMenuAction[] => {
  if (editor.isActive("tableCell") || editor.isActive("tableRow")) {
    return [
      {
        label: "Split cell",
        icon: <Split className="h-4 w-4" />,
        onClick: () => editor.commands.splitCell(),
        disabled: !editor.can().splitCell(),
      },
      {
        label: "Align Left",
        icon: <AlignLeft />,
        onClick: () => editor.commands.setCellAlignmentLeft(),
      },
      {
        label: "Align Center",
        icon: <AlignCenter />,
        onClick: () => editor.commands.setCellAlignmentCenter(),
      },
      {
        label: "Align Right",
        icon: <AlignRight />,
        onClick: () => editor.commands.setCellAlignmentRight(),
      },
      {
        label: "Merge cells",
        icon: <Merge className="h-4 w-4" />,
        onClick: () => editor.commands.mergeCells(),
        disabled: !editor.can().mergeCells(),
      },
      {
        label: "Add row after",
        icon: <Plus className="h-4 w-4" />,
        onClick: () => editor.chain().addRowAfter().run(),
      },
      {
        label: "Add column after",
        icon: <Plus className="h-4 w-4" />,
        onClick: () => editor.chain().addColumnAfter().run(),
      },
      {
        label: "Delete row",
        danger: true,
        icon: <Grid2x2X className="h-4 w-4" />,
        onClick: () => editor.commands.deleteRow(),
      },
      {
        label: "Delete column",
        danger: true,
        icon: <Grid2x2X className="h-4 w-4" />,
        onClick: () => editor.commands.deleteColumn(),
      },
    ];
  }

  return [];
};

const HeadingContextMenuItems = (editor: Editor): ContextMenuAction[] => {
  if (editor.isActive("heading")) {
    return [
      {
        label: "Paragraph",
        icon: <Type className="h-4 w-4" />,
        onClick: () => editor.chain().focus().setParagraph().run(),
      },
      {
        label: "Heading 2",
        icon: <Heading2 className="h-4 w-4" />,
        onClick: () => editor.chain().focus().setHeading({ level: 2 }).run(),
      },
      {
        label: "Heading 3",
        icon: <Heading3 className="h-4 w-4" />,
        onClick: () => editor.chain().focus().setHeading({ level: 3 }).run(),
      },
      {
        label: "Heading 4",
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
        label: "Outdent item",
        icon: <CornerUpLeft className="h-4 w-4" />,
        disabled: !editor.can().liftListItem("listItem"),
        onClick: () => editor.chain().focus().liftListItem("listItem").run(),
      },
      {
        label: "Indent item",
        icon: <CornerUpRight className="h-4 w-4" />,
        disabled: !editor.can().sinkListItem("listItem"),
        onClick: () => editor.chain().focus().sinkListItem("listItem").run(),
      },
      {
        label: "Toggle bullet list",
        icon: <List className="h-4 w-4" />,
        onClick: () => editor.chain().focus().toggleBulletList().run(),
      },
      {
        label: "Toggle ordered list",
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
        label: "Delete image",
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
        label: "Delete figure table",
        icon: <Trash2 className="h-4 w-4" />,
        danger: true,
        onClick: () => editor.commands.deleteFigureTable(),
      },
    ];
  }

  return [];
};

const MathContextMenuItems = (editor: Editor): ContextMenuAction[] => {
  if (editor.isActive("mathBlock") || editor.isActive("mathInline")) {
    return [
      {
        label: "Delete math",
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
        label: "Remove quote",
        icon: <Quote className="h-4 w-4" />,
        onClick: () => editor.chain().focus().toggleBlockquote().run(),
      },
    ];
  }

  return [];
};
