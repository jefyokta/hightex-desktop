import { EditorGuide } from "@/components/editor/editor-guide";
import { ExpandableSideBar } from "@/components/editor/expandable-sidebar";
import { Scanner } from "@/components/editor/scanner";
import { EditorChrome } from "@/components/editor/editor-chrome";
import { EditorProvider } from "@/hooks/use-editor";
import { ExpandableSideBarContextProvider } from "@/hooks/use-expandable-sidebar";
import { GraphContextProvider } from "@/hooks/use-graph";
import { ParamsContextProvider } from "@/hooks/use-params";
import { AliasSlave } from "@/slaves/alias-slave";
import { EditorNavigatorSlave } from "@/slaves/editor-navigator";
import { EditorFlushSlave } from "@/slaves/editor-flush";
import { FrameSlave } from "@/slaves/frame";

import { Outlet } from "react-router-dom";

export const EditorLayout: React.FC = () => {
  return (
    <ParamsContextProvider>
      <EditorChrome>
        <GraphContextProvider>
          <EditorProvider>
            <ExpandableSideBarContextProvider>
              <div className="flex h-full w-full ">
                <ExpandableSideBar />
                <AliasSlave />
                <Outlet />
              </div>
              <EditorGuide />
            </ExpandableSideBarContextProvider>
            <EditorNavigatorSlave />
            <EditorFlushSlave />
            <Scanner />
          </EditorProvider>
        </GraphContextProvider>
      </EditorChrome>
      <FrameSlave />
    </ParamsContextProvider>
  );
};
