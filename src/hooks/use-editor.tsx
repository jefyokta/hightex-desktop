import { Editor } from "@tiptap/core";
import { createContext, PropsWithChildren, useContext, useState } from "react";

export const EditorContext = createContext<{
  editor: Editor | null;
  setEditor: (props: any) => any;
}>({ editor: null, setEditor: () => {} });

export const EditorProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const [editor, setEditor] = useState(null);

  return (
    <EditorContext.Provider value={{ editor, setEditor }}>
      {children}
    </EditorContext.Provider>
  );
};

export const useCurrentEditor = () => useContext(EditorContext);
