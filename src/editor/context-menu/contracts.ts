import type { Editor } from "@tiptap/core";
import type { ContextMenuAction } from "@/hooks/use-context-menu";
import type { EditorContextTarget } from "./target";

export interface ContextMenuContext {
  readonly editor: Editor;
  readonly target: Pick<EditorContextTarget, "node" | "find" | "delete">;
}

export interface NodeActionItem extends ContextMenuAction {
  /** A specific action with this key replaces its global default. */
  readonly key?: string;
}

/** The collection calls items only when supports accepts the current context. */
export interface ContextMenuActionProvider {
  supports(context: ContextMenuContext): boolean;
  items(context: ContextMenuContext): NodeActionItem[];
}
