import { createContext, useContext, type PropsWithChildren } from "react";
import type { Editor } from "@tiptap/core";
import type { Document } from "@/editor/document";
import { useDocumentPDF, type DocumentPDFRequest } from "@/hooks/use-document-pdf";

const DocumentPDFContext = createContext<(DocumentPDFRequest & { source: Editor | Document | null }) | null>(null);

/** Toolbar and page controls share the active document's one export lifecycle. */
export function DocumentPDFProvider({ source, children }: PropsWithChildren<{ source: Editor | Document | null }>) {
  const request = useDocumentPDF(source);
  return <DocumentPDFContext.Provider value={{ ...request, source }}>{children}</DocumentPDFContext.Provider>;
}

export function useDocumentPDFRequest(source?: Editor | Document) {
  const request = useContext(DocumentPDFContext);
  return source === undefined || request?.source === source ? request : null;
}
