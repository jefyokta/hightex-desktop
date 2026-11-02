import type { PropsWithChildren } from "react";
import { MacosEditorHead } from "@/components/navbar";

export const EditorChrome = ({ children }: PropsWithChildren) => (
  <div
    data-editor-shell
    className="relative flex h-screen min-h-0 flex-col overflow-hidden"
  >
    <MacosEditorHead />
    <div
      data-editor-workspace
      className="relative min-h-0 flex-1 overflow-hidden"
    >
      {children}
    </div>
  </div>
);
