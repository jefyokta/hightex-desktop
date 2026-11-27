import { createRoot } from "react-dom/client";
import type { Editor } from "@tiptap/core";
import { EditorContextMenu } from "@/editor/context-menu";
import { ContextMenuPopup } from "@/components/context-menu";
export { setCurrentLanguage, t } from "@/utils/lang";

export function mountTableWidthContextMenu(editor: Editor) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  root.render(<ContextMenuPopup />);
  const menu = new EditorContextMenu(editor, {});
  return () => { menu.destroy(); root.unmount(); host.remove(); };
}
