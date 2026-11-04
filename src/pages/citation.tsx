import { useCallback } from "react";
import { Plus, Search } from "lucide-react";
import { Zotero } from "@/assets/icons/zotero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CitationList } from "@/components/citation/citation-list";
import { BibtexImportDialog } from "@/components/citation/bibtex-import-dialog";
import { ZoteroImportDialog } from "@/components/citation/zotero-import-dialog";
import { useCitationLibrary } from "@/hooks/use-citation-library";
import { useBibtexImport } from "@/hooks/use-bibtex-import";
import { useZoteroImport } from "@/hooks/use-zotero-import";
import { t, useAppLanguage } from "@/utils/lang";
import { PageHeader } from "@/components/dashboard/page-header";

export const Citation = () => {
  useAppLanguage();
  const {
    citations,
    loading,
    error,
    retry,
    query,
    setQuery,
    filtered,
    deleteCitation,
    importBibtex,
  } = useCitationLibrary();
  const bibtex = useBibtexImport();
  const { resetText } = bibtex;
  const handleImport = useCallback(
    async (content: string) => {
      const count = await importBibtex(content);
      if (count > 0) resetText();
      return count;
    },
    [importBibtex, resetText],
  );
  const zotero = useZoteroImport(handleImport);

  return (
    <div className="flex min-h-[65vh] flex-col gap-7">
      <PageHeader
        eyebrow={t("workspace.library")}
        title={t("citation.title")}
        description={t("citation.subtitle")}
        actions={
          <>
            <Button
              variant="outline"
              data-tour="reference-zotero"
              onClick={zotero.openImport}
              disabled={loading}
            >
              <Zotero className="size-4" />
              {t("citation.import_zotero")}
            </Button>
            <Button
              className="workspace-primary"
              data-tour="reference-add"
              onClick={() => bibtex.setOpen(true)}
              disabled={loading}
            >
              <Plus />
              {t("citation.add")}
            </Button>
          </>
        }
      />
      <section className="overflow-hidden border-t">
        <div className="pb-4 pt-5">
          <div className="relative">
            <Search className="pointer-events-none absolute top-3 left-3 size-4 text-muted-foreground" />
            <Input
              data-tour="reference-search"
              type="search"
              aria-label={t("citation.search", { count: citations.length })}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("citation.search", { count: citations.length })}
              className="h-10 bg-background pl-10"
            />
          </div>
        </div>
        <div className="min-h-64">
          {loading ? (
            <p
              role="status"
              className="p-8 text-center text-sm text-muted-foreground"
            >
              {t("citation.loading")}
            </p>
          ) : error ? (
            <div
              role="alert"
              className="flex min-h-64 flex-col items-center justify-center gap-4 p-8 text-center"
            >
              <p className="text-sm text-muted-foreground">
                {t("citation.load_failed")}
              </p>
              <Button variant="outline" onClick={retry}>
                {t("dashboard.retry")}
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            <div
              data-tour="reference-empty"
              className="flex min-h-64 flex-col items-center justify-center gap-3 p-8 text-center text-sm text-muted-foreground"
            >
              <p>
                {query.trim() ? t("dashboard.no_results") : t("citation.empty")}
              </p>
              {query.trim() && (
                <Button variant="outline" onClick={() => setQuery("")}>
                  {t("dashboard.clear_filters")}
                </Button>
              )}
            </div>
          ) : (
            <CitationList cites={filtered} onDelete={deleteCitation} />
          )}
        </div>
      </section>

      <BibtexImportDialog
        form={bibtex}
        onImport={() => handleImport(bibtex.bibText)}
      />
      <ZoteroImportDialog importer={zotero} />
    </div>
  );
};
