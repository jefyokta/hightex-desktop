import type { Editor } from "@tiptap/core";
import {
  createContext,
  type Dispatch,
  type PropsWithChildren,
  type SetStateAction,
  useContext,
  useState,
} from "react";

export const EditorContext = createContext<{
  editor: Editor | null;
  setEditor: Dispatch<SetStateAction<Editor | null>>;
}>({ editor: null, setEditor: () => {} });

export const EditorProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const [editor, setEditor] = useState<Editor | null>(null);

  return (
    <EditorContext.Provider value={{ editor, setEditor }}>
      {children}
    </EditorContext.Provider>
  );
};

export const useCurrentEditor = () => useContext(EditorContext);
