import { useEffect, useState, type ReactNode } from "react";
import type { Editor } from "@tiptap/core";
import type { Document } from "@/editor/document";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { t } from "@/utils/lang";
import { CodeXml, FileDown, Loader2, MoreHorizontal } from "lucide-react";
import { PDFRequestStatus } from "./pdf-request-status";
import { useAppLanguage } from "@/hooks/use-app-language";
import { useDocumentPDF, type DocumentPDFRequest } from "@/hooks/use-document-pdf";
import { useDocumentPDFRequest } from "@/context/document-pdf-context";

interface PDFControlsProps {
  editor: Editor | Document;
  disabled: boolean;
  status?: ReactNode;
  options?: ReactNode;
}

export function EditorPDFExperimental(props: PDFControlsProps) {
  const shared = useDocumentPDFRequest(props.editor);
  return shared ? <DocumentPDFControls {...props} request={shared} /> : <StandalonePDFControls {...props} />;
}

function StandalonePDFControls(props: PDFControlsProps) {
  const request = useDocumentPDF(props.editor);
  return <DocumentPDFControls {...props} request={request} />;
}

function DocumentPDFControls({ editor, disabled, status, options, request }: PDFControlsProps & { request: DocumentPDFRequest }) {
  useAppLanguage();
  const { busy, exportButton, prepare } = request;
  const [optionsOpen, setOptionsOpen] = useState(false);
  useEffect(() => setOptionsOpen(false), [editor]);

  return (
    <section className="w-full min-w-0 space-y-2" aria-busy={busy}>
      <div className="flex flex-wrap items-center gap-2">
        {status && (
          <div className="min-w-0 flex-1" role="status">
            {status}
          </div>
        )}
        <Button
          ref={exportButton}
          type="button"
          size="sm"
          data-editor-pdf-export
          title={t("editor.pagination.pdf_description")}
          disabled={disabled || busy}
          onClick={() => void prepare("export")}
        >
          {busy ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" /> : <FileDown className="size-4" />}
          {t(busy ? "editor.pagination.pdf_in_progress" : "editor.pagination.pdf_action")}
        </Button>

        {(options || import.meta.env.DEV) && (
          <Popover open={optionsOpen} onOpenChange={setOptionsOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                data-editor-pdf-options
                aria-label={t("editor.pagination.pdf_options")}
                title={t("editor.pagination.pdf_options")}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              data-editor-pdf-options-panel
              aria-label={t("editor.pagination.pdf_options")}
              className="max-h-[var(--radix-popover-content-available-height)] w-72 max-w-[calc(100vw-1.5rem)] space-y-1 overflow-y-auto p-3 text-xs [&>button]:w-full [&>button]:justify-start"
            >
              {options}
              {import.meta.env.DEV && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  data-editor-pdf-debug
                  disabled={disabled || busy}
                  onClick={() => {
                    setOptionsOpen(false);
                    void prepare("debug");
                  }}
                >
                  <CodeXml className="size-4" /> Debug HTML
                </Button>
              )}
            </PopoverContent>
          </Popover>
        )}
      </div>
      <PDFRequestStatus request={request} editor={"commands" in editor ? editor : undefined} />
    </section>
  );
}
