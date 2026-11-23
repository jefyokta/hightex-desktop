import type { Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { Eye, Trash2 } from "lucide-react";
import {
  closeContextMenu,
  openContextMenu,
  type ContextMenuItem,
} from "@/hooks/use-context-menu";
import { t } from "@/utils/lang";
import { getContextMenuItems } from "./actions";
import { EditorContextTarget } from "./target";

type ContextMenuOptions = {
  preview: (id: string) => void;
  inspect?: (x: number, y: number) => void;
};

export class EditorContextMenu {
  private readonly root: HTMLElement;

  constructor(
    private readonly editor: Editor,
    private readonly options: ContextMenuOptions,
  ) {
    this.root = editor.view.dom;
    this.root.addEventListener("contextmenu", this.handle);
    editor.on("update", this.close);
  }

  destroy() {
    this.root.removeEventListener("contextmenu", this.handle);
    this.editor.off("update", this.close);
    this.close();
  }

  private readonly close = () => closeContextMenu();

  private readonly handle = (event: MouseEvent) => {
    const target = EditorContextTarget.resolve(this.editor.view, event);
    const items: ContextMenuItem[] = [];

    if (target) {
      target.select(this.editor);
      const actions = getContextMenuItems(this.editor, target);
      items.push(...actions);
      if (items.length) items.push({ type: "separator" });
      if (target.node.attrs.id)
        items.push({
          label: t("editor.context_menu.see_in_preview"),
          icon: <Eye className="h-4 w-4" />,
          onClick: () => this.options.preview(target.node.attrs.id),
        });
      if (!actions.some(action => action.danger))
        items.push({
          label: t("editor.context_menu.delete"),
          icon: <Trash2 className="h-4 w-4" />,
          danger: true,
          onClick: () => {
            const { selection } = this.editor.state;
            if (selection instanceof TextSelection && !selection.empty)
              this.editor.commands.deleteSelection();
            else target.delete(this.editor);
          },
        });
    }

    if (this.options.inspect) {
      if (items.length) items.push({ type: "separator" });
      items.push({
        label: "Inspect Element",
        onClick: () => this.options.inspect?.(event.clientX, event.clientY),
      });
    }

    if (!items.length) return;
    event.preventDefault();
    openContextMenu(event.clientX, event.clientY, items, target?.element);
  };
}
