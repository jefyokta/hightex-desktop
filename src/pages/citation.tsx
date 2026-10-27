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
import { t } from "@/utils/lang";

export const Citation = () => {
  const {
    citations,
    loading,
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

  if (loading) {
    return (
      <div className="flex-1 p-6">
        <div className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">
          {t("citation.loading")}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full max-w-3xl flex-1 flex-col p-6 mx-auto">
      <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("citation.title")}
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            {t("citation.subtitle")}
          </p>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-muted/20">
          <div className="flex shrink-0 flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm font-medium">{t("citation.actions")}</div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => bibtex.setOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                {t("citation.add")}
              </Button>

              <Button variant="outline" onClick={zotero.openImport}>
                <Zotero className="mr-2 h-2 w-2" />
                {t("citation.import_zotero")}
              </Button>
            </div>
          </div>

          <div className="shrink-0 px-4 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("citation.search", {
                  count: citations.length,
                })}
                className="h-10 w-full rounded-xl border-0 bg-background/70 pl-10 pr-4 text-sm outline-none ring-1 ring-transparent transition focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden px-2 pb-2">
            {filtered.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-xl text-sm text-muted-foreground">
                {t("citation.empty")}
              </div>
            ) : (
              <CitationList cites={filtered} onDelete={deleteCitation} />
            )}
          </div>
        </div>
      </div>

      <BibtexImportDialog
        form={bibtex}
        onImport={() => handleImport(bibtex.bibText)}
      />
      <ZoteroImportDialog importer={zotero} />
    </div>
  );
};
