import { BookMarked, Plus, Search } from "lucide-react";
import { useRef, useState } from "react";
import type { Editor } from "@tiptap/core";
import type { EditorState } from "@tiptap/pm/state";
import { Zotero } from "@/assets/icons/zotero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BibtexImportDialog } from "@/components/citation/bibtex-import-dialog";
import { CitationAuthorsDialog } from "@/components/citation/citation-authors-dialog";
import { EditorCitationList } from "@/components/citation/editor-citation-list";
import { ZoteroImportDialog } from "@/components/citation/zotero-import-dialog";
import { useAppLanguage } from "@/hooks/use-app-language";
import { useBibtexImport } from "@/hooks/use-bibtex-import";
import { useCitationAuthors } from "@/hooks/use-citation-authors";
import { useCitationLibrary } from "@/hooks/use-citation-library";
import { useZoteroImport } from "@/hooks/use-zotero-import";
import { useCurrentEditor } from "@/hooks/use-editor";
import { ReferencePickerDialog } from "@/components/citation/reference-picker-dialog";
import { t } from "@/utils/lang";
import { TabHeader } from "./components/tab-header";
import { useParams } from "react-router-dom";
import { useReferenceUsage } from "@/hooks/use-reference-usage";
import { useScannerNavigation } from "@/hooks/use-scanner-navigation";

export function Citation() {
  useAppLanguage();
  const library = useCitationLibrary();
  const { loading, error, filtered, query, setQuery, retry } = library;
  const bibtex = useBibtexImport(library.importBibtex);
  const zotero = useZoteroImport(library.importBibtex);
  const authors = useCitationAuthors(library.updateAuthors);
  const { editor } = useCurrentEditor();
  const { id } = useParams();
  const usage = useReferenceUsage(id);
  const navigateUsage = useScannerNavigation();
  const [pickerOpen, setPickerOpen] = useState(false);
  const insertion = useRef<{ editor: Editor; state: EditorState }>();

  const openPicker = (open: boolean) => {
    insertion.current = open && editor ? { editor, state: editor.state } : undefined;
    setPickerOpen(open);
  };

  const insertReference = (key: string) => {
    const target = insertion.current;
    openPicker(false);
    if (!target || target.editor !== editor || editor.isDestroyed || !editor.isEditable) return;
    if (editor.state.doc !== target.state.doc) return;
    const { from, to } = target.state.selection;
    editor.chain().focus().insertContentAt({ from, to }, { type: "cite", attrs: { cite: key, citeA: false } }).run();
  };

  return (
    <div data-tour="editor-citation-library" className="flex h-full flex-col bg-background">
      <TabHeader title={t("editor.expandable.citation.title")} desc={t("editor.expandable.citation.description")} />
      <div className="flex gap-2 border-b px-3 py-3">
        <Button size="sm" className="min-w-0 flex-1 gap-1.5 rounded-xl px-2 text-[11px] whitespace-nowrap"
          disabled={loading || error} onClick={() => bibtex.setOpen(true)}>
          <Plus className="size-4 shrink-0" />{t("citation.add")}
        </Button>
        <Button size="sm" variant="outline" className="min-w-0 flex-1 gap-1.5 rounded-xl px-2 text-[11px] whitespace-nowrap"
          disabled={loading || error} onClick={zotero.openImport}>
          <Zotero className="size-3.5 shrink-0 fill-current" />{t("citation.import_zotero")}
        </Button>
      </div>
      <Button variant="outline" className="mx-3 mt-3" onClick={() => openPicker(true)} disabled={!editor?.isEditable}>
        <Search className="size-4" />{t("editor.inline.citation_add")}
      </Button>
      <div className="border-b p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input type="search" aria-label={t("editor.expandable.citation.search")} value={query}
            onChange={event => setQuery(event.target.value)} placeholder={t("editor.expandable.citation.search")}
            className="h-10 rounded-xl bg-background pl-10 pr-4" />
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4 pb-20">
        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="rounded-2xl border p-4">
                <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />

                <div className="mt-3 h-3 w-full animate-pulse rounded bg-muted" />

                <div className="mt-2 h-3 w-5/6 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-16 text-center">
            <BookMarked className="h-10 w-10 text-muted-foreground" />

            <h2 className="mt-4 text-sm font-medium">
              {t("editor.expandable.citation.empty")}
            </h2>

            <p className="mt-1 text-xs text-muted-foreground">
              {t("editor.expandable.citation.empty_description")}
            </p>
          </div>
        )}

        {!loading && error && (
          <div role="alert" className="space-y-3 py-8 text-center text-sm text-muted-foreground">
            <p>{t("citation.load_failed")}</p>
            <Button variant="outline" onClick={retry}>{t("dashboard.retry")}</Button>
          </div>
        )}
        {!loading && !error && filtered.length > 0 && (
          <EditorCitationList citations={filtered} onEdit={authors.edit} usage={usage} onNavigateUsage={location => void navigateUsage({
            pluginId: "reference-usage", code: "usage", message: location.excerpt, severity: "warning",
            chapterId: location.chapterId, path: location.path, nodeId: location.nodeId,
          })} />
        )}
      </div>
      <BibtexImportDialog form={bibtex} />
      <ZoteroImportDialog importer={zotero} />
      <CitationAuthorsDialog form={authors} />
      <ReferencePickerDialog open={pickerOpen && insertion.current?.editor === editor} onOpenChange={openPicker} onChoose={insertReference} />
    </div>
  );
}
