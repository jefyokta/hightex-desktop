import { ExpandableSideBar } from "@/components/editor/expandable-sidebar";
import { MacosEditorHead } from "@/components/navbar";
import { EditorProvider } from "@/hooks/use-editor";
import { ExpandableSideBarContextProvider } from "@/hooks/use-expandable-sidebar";
import { GraphContextProvider } from "@/hooks/use-graph";
import { ParamsContextProvider } from "@/hooks/use-params";
import { EditorNavigatorSlave } from "@/slaves/editor-navigator";
import { FrameSlave } from "@/slaves/frame";

import { Outlet } from "react-router-dom";

export const EditorLayout: React.FC = () => {
  return (
    <ParamsContextProvider>
      <div className="h-screen overflow-hidden relative">
        <MacosEditorHead />
        <GraphContextProvider>
          <EditorProvider>
            <ExpandableSideBarContextProvider>
              <div className="flex h-full w-full">
                <ExpandableSideBar />
                <Outlet />
              </div>
            </ExpandableSideBarContextProvider>
            <EditorNavigatorSlave />
          </EditorProvider>
        </GraphContextProvider>
      </div>
      <FrameSlave />
    </ParamsContextProvider>
  );
};
