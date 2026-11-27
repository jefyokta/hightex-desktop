import type { Editor } from "@tiptap/core";
import { DocumentPDFProvider } from "@/context/document-pdf-context";
import { useChapterStore } from "./use-chapter";
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
  const { chapter } = useChapterStore();

  return (
    <EditorContext.Provider value={{ editor, setEditor }}>
      <DocumentPDFProvider source={chapter?.frozen ? chapter.document : editor}>
        {children}
      </DocumentPDFProvider>
    </EditorContext.Provider>
  );
};

export const useCurrentEditor = () => useContext(EditorContext);
