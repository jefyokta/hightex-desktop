import type { Editor } from "@tiptap/core";
import {
  closeContextMenu,
  openContextMenu,
  type ContextMenuItem,
} from "@/hooks/use-context-menu";
import { ContextMenuActions } from "./actions";
import { EditorContextTarget } from "./target";

type ContextMenuOptions = {
  inspect?: (x: number, y: number) => void;
};

export class EditorContextMenu {
  private readonly root: HTMLElement;
  private readonly actions = new ContextMenuActions();

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
      const actions = this.actions.collect({ editor: this.editor, target });
      items.push(...actions);
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
