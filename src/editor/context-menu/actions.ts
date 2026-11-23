import type { Editor } from "@tiptap/core";
import type { ContextMenuAction } from "@/hooks/use-context-menu";
import type { EditorContextTarget } from "./target";
import { tableContextActions } from "./table-actions";
import { textContextActions } from "./text-actions";
import { nodeContextActions } from "./node-actions";

export function getContextMenuItems(
  editor: Editor,
  target: EditorContextTarget,
): ContextMenuAction[] {
  return [
    ...nodeContextActions(editor, target),
    ...tableContextActions(editor),
    ...textContextActions(editor),
  ];
}
