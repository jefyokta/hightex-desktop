import { ChapteTree } from "@/components/editor/expandable-items/chapter-tree";
import { Citation } from "@/components/editor/expandable-items/citation";
import { Preview } from "@/components/editor/expandable-items/preview";
import { Scanner } from "@/components/editor/expandable-items/scanner";
import { Setting } from "@/components/editor/expandable-items/setting";
import { VariableTab } from "@/components/editor/expandable-items/variables";
import React, {
  createContext,
  Dispatch,
  PropsWithChildren,
  SetStateAction,
  useContext,
  useState,
} from "react";

export const tabs = {
  chapterTree: {
    name: "Chapters",
    component: ChapteTree,
    element: <ChapteTree />,
  },
  previewer: {
    name: "previewer",
    component: Preview,
    element: <Preview />,
  },
  scanner: {
    name: "Scanner",
    component: Scanner,
    element: <Scanner />,
  },
  citation: {
    name: "Citation",
    component: Citation,
    element: <Citation />,
  },
  setting: {
    name: "Setting",
    component: Setting,
    element: <Setting />,
  },
  variabl: {
    name: "Variable",
    component: VariableTab,
    element: <VariableTab />,
  },
} as const;

export type SidebarTab = keyof typeof tabs;

type ExpandableSidebarContextType = {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;

  content: SidebarTab;
  setContent: Dispatch<SetStateAction<SidebarTab>>;
};

const ExpandableSideBarContext = createContext<ExpandableSidebarContextType>({
  open: false,
  setOpen: () => {},

  content: "chapterTree",
  setContent: () => {},
});

export const ExpandableSideBarContextProvider: React.FC<PropsWithChildren> = ({
  children,
}) => {
  const [open, setOpen] = useState(false);

  const [content, setContent] = useState<SidebarTab>("chapterTree");

  return (
    <ExpandableSideBarContext.Provider
      value={{
        open,
        setOpen,

        content,
        setContent,
      }}
    >
      {children}
    </ExpandableSideBarContext.Provider>
  );
};

export const useExpandableSidebar = () => useContext(ExpandableSideBarContext);
