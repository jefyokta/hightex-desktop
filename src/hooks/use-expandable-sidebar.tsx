import { Citation } from "@/components/editor/expandable-items/citation";
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
  citation: {
    name: "editor.expandable.citation.title",
    element: <Citation />,
  },
  setting: {
    name: "editor.expandable.setting.title",
    element: <Setting />,
  },
  variabl: {
    name: "editor.inline.variables_title",
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

  content: "citation",
  setContent: () => {},
});

export const ExpandableSideBarContextProvider: React.FC<PropsWithChildren> = ({
  children,
}) => {
  const [open, setOpen] = useState(false);

  const [content, setContent] = useState<SidebarTab>("citation");

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
