import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { CiteUtils } from "bibtex.js";
import { HighTexDB } from "../editor/storage/hightex-db";
import { parseBibtexInput, isCitationValid } from "@/utils/citation";
import { DEFAULT_ZOTERO_CONFIG, type ZoteroItem } from "@/utils/zotero";
import { t } from "@/utils/lang";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

import { Search, Trash, Copy, Quote, Plus } from "lucide-react";
import { Zotero } from "@/assets/icons/zotero";

export const Citation = () => {
  const [citations, setCitations] = useState<CiteUtils[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [bibText, setBibText] = useState("");

  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackType, setFeedbackType] = useState<"success" | "error" | null>(
    null,
  );

  const [isZoteroOpen, setIsZoteroOpen] = useState(false);

  const [zoteroItems, setZoteroItems] = useState<ZoteroItem[]>([]);
  const [zoteroLoading, setZoteroLoading] = useState(false);
  const [zoteroError, setZoteroError] = useState<string | null>(null);
  const [zoteroConnected, setZoteroConnected] = useState<boolean | null>(null);
  const [selectedZoteroIds, setSelectedZoteroIds] = useState<string[]>([]);

  const db = HighTexDB.getInstance();

  const loadCitations = async () => {
    const rows = await db.cite.toArray();

    return rows.map((citation) =>
      new CiteUtils(citation.bib).setId(citation.key),
    );
  };

  useEffect(() => {
    let alive = true;

    (async () => {
      const mapped = await loadCitations();

      if (!alive) return;

      setCitations(mapped);
      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) {
      return citations;
    }

    const lower = query.toLowerCase();

    return citations.filter((cite) => {
      const content = JSON.stringify(cite.getCite()).toLowerCase();

      return (
        cite.getId().toLowerCase().includes(lower) ||
        cite.getTitle().toLowerCase().includes(lower) ||
        content.includes(lower)
      );
    });
  }, [citations, query]);

  const deleteCitation = async (id: string) => {
    setCitations((previous) =>
      previous.filter((citation) => citation.getId() !== id),
    );

    await db.cite.delete(id);
  };

  const copyCitation = async (text: string) => {
    await navigator.clipboard.writeText(text);
  };

  const resetForm = () => {
    setBibText("");
    setFeedback(null);
    setFeedbackType(null);
  };

  const closeModal = () => {
    resetForm();
    setIsAddOpen(false);
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) return;

    const content = await file.text();

    setBibText(content.trim());
    setFeedback(null);
    setFeedbackType(null);
  };

  const ensureUniqueKey = async (
    key: string,
    existing: Set<string>,
  ): Promise<string> => {
    let candidate = key;
    let suffix = 1;

    while (existing.has(candidate)) {
      candidate = `${key}_${suffix}`;
      suffix += 1;
    }

    existing.add(candidate);

    return candidate;
  };

  const importBibtexContent = async (
    content: string,
    openModal = false,
  ): Promise<number> => {
    setFeedback(null);
    setFeedbackType(null);

    if (!content.trim()) {
      setFeedback(t("citation.error.no_bibtex_content"));
      setFeedbackType("error");

      return 0;
    }

    const { entries, errors } = parseBibtexInput(content);

    if (errors.length > 0) {
      setFeedback(errors.join(" "));
      setFeedbackType("error");

      return 0;
    }

    const validEntries = entries.filter((entry) => isCitationValid(entry.cite));

    const invalidEntries = entries.filter(
      (entry) => !isCitationValid(entry.cite),
    );

    if (validEntries.length === 0) {
      setFeedback(
        invalidEntries.length > 0
          ? t("citation.error.no_valid_citations")
          : t("citation.error.no_citations_parsed"),
      );

      setFeedbackType("error");

      return 0;
    }

    const existingKeys = new Set(
      (await db.cite.toArray()).map((item) => item.key),
    );

    const citationsToSave = await Promise.all(
      validEntries.map(async (entry) => ({
        key: await ensureUniqueKey(entry.key, existingKeys),
        bib: entry.bib,
      })),
    );

    await db.cite.bulkPut(citationsToSave);

    const mapped = await loadCitations();

    setCitations(mapped);

    setFeedback(
      t("citation.imported", {
        count: citationsToSave.length,
        skipped:
          invalidEntries.length > 0
            ? t("citation.skipped_invalid", {
                count: invalidEntries.length,
              })
            : "",
      }),
    );

    setFeedbackType("success");
    setBibText("");

    if (openModal) {
      setIsAddOpen(true);
    }

    return citationsToSave.length;
  };

  const getZoteroConfig = async () => {
    await window.config.ready();

    const zoteroConfig = window.config.get()?.zotero;

    return zoteroConfig ?? DEFAULT_ZOTERO_CONFIG;
  };

  const refreshZoteroConnection = async () => {
    const { host, port, enabled } = await getZoteroConfig();

    if (!enabled) {
      setZoteroConnected(false);
      setZoteroError(t("citation.zotero.integration_disabled"));

      return false;
    }

    setZoteroLoading(true);
    setZoteroError(null);

    try {
      const result = await window.zotero.testConnection(host, port);

      if (!result?.connected) {
        setZoteroConnected(false);

        setZoteroError(
          result?.message ?? t("citation.zotero.connection_failed"),
        );

        return false;
      }

      setZoteroConnected(true);

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      setZoteroConnected(false);
      setZoteroError(message);

      return false;
    } finally {
      setZoteroLoading(false);
    }
  };

  const loadZoteroItems = async () => {
    const { host, port } = await getZoteroConfig();

    setZoteroLoading(true);
    setZoteroError(null);

    try {
      const items = await window.zotero.listItems(host, port, 100);

      setZoteroItems(items || []);
      setSelectedZoteroIds([]);

      if (!items || items.length === 0) {
        setZoteroError(t("citation.zotero.no_references"));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      setZoteroError(message);
    } finally {
      setZoteroLoading(false);
    }
  };

  const openZoteroImport = async () => {
    setIsZoteroOpen(true);
    setZoteroError(null);
    setZoteroItems([]);
    setSelectedZoteroIds([]);

    const connected = await refreshZoteroConnection();

    if (connected) {
      await loadZoteroItems();
    }
  };

  const toggleZoteroSelection = (key: string) => {
    setSelectedZoteroIds((previous) =>
      previous.includes(key)
        ? previous.filter((id) => id !== key)
        : [...previous, key],
    );
  };

  const importSelectedZoteroItems = async () => {
    if (selectedZoteroIds.length === 0) {
      setZoteroError(t("citation.zotero.select_reference"));

      return;
    }

    const selectedItems = zoteroItems.filter((item) =>
      selectedZoteroIds.includes(item.key),
    );

    if (!selectedItems.length) {
      setZoteroError(t("citation.zotero.no_matching_references"));

      return;
    }

    const { host, port } = await getZoteroConfig();

    try {
      const bibtexPayloads = await Promise.all(
        selectedItems.map((item) =>
          window.zotero.exportBibtex(host, port, item.key),
        ),
      );

      const importedCount = await importBibtexContent(
        bibtexPayloads.filter(Boolean).join("\n\n"),
      );

      if (importedCount === 0) {
        setZoteroError(t("citation.zotero.no_valid_imported"));

        return;
      }

      const mapped = await loadCitations();

      setCitations(mapped);

      setFeedback(
        t("citation.zotero.imported", {
          count: importedCount,
        }),
      );

      setFeedbackType("success");
      setIsZoteroOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      setZoteroError(message);
    }
  };

  const addCitation = async () => {
    await importBibtexContent(bibText);
  };

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
              <Button onClick={() => setIsAddOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                {t("citation.add")}
              </Button>

              <Button variant="outline" onClick={openZoteroImport}>
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
              <div className="h-full divide-y divide-muted/40 overflow-y-auto rounded-xl">
                {filtered.map((cite) => (
                  <div
                    key={cite.getId()}
                    className="px-3 py-2 transition hover:bg-muted/30"
                  >
                    <CitationRow
                      cite={cite}
                      onDelete={deleteCitation}
                      onCopy={copyCitation}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent
          showCloseButton
          className="max-w-none! flex h-[85vh] w-[70vw] flex-col overflow-hidden"
        >
          <DialogHeader className="flex-none border-b px-6 py-5">
            <DialogTitle>{t("citation.import_title")}</DialogTitle>

            <DialogDescription>
              {t("citation.import_description")}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-none items-center justify-between gap-3 border-b px-6 py-4">
            <label className="text-sm font-medium">
              {t("citation.bibtex_content")}
            </label>

            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border bg-background px-3 py-2 text-xs font-medium transition hover:bg-muted">
              {t("citation.upload_bib")}
              <input
                type="file"
                accept=".bib,application/x-bibtex,text/x-bibtex"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-6 py-5">
            <Textarea
              value={bibText}
              onChange={(event) => setBibText(event.target.value)}
              placeholder={t("citation.bibtex_placeholder")}
              className="min-h-0 flex-1 resize-none font-mono text-sm"
            />

            <div className="flex flex-none items-center justify-between rounded-xl border bg-muted/30 px-4 py-3 text-sm">
              <div className="text-muted-foreground">
                {t("citation.validation_description")}
              </div>

              <Badge variant="secondary">BibTeX</Badge>
            </div>

            {feedback && (
              <div
                className={`flex-none rounded-xl border px-4 py-3 text-sm ${
                  feedbackType === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
                }`}
              >
                {feedback}
              </div>
            )}
          </div>

          <DialogFooter className="flex-none border-t px-6 py-4">
            <Button variant="outline" onClick={closeModal}>
              {t("common.cancel")}
            </Button>

            <Button onClick={addCitation}>{t("citation.import")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isZoteroOpen} onOpenChange={setIsZoteroOpen}>
        <DialogContent
          showCloseButton
          className="max-w-none! flex h-[85vh] w-[70vw] flex-col gap-0 overflow-hidden"
        >
          <DialogHeader className="shrink-0 border-b px-6 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <DialogTitle className="text-xl">
                  {t("citation.zotero.title")}
                </DialogTitle>

                <DialogDescription className="mt-1">
                  {t("citation.zotero.description")}
                </DialogDescription>
              </div>

              <Badge
                variant={zoteroConnected ? "default" : "destructive"}
                className="mt-1"
              >
                {zoteroConnected === null
                  ? t("citation.zotero.checking")
                  : zoteroConnected
                    ? t("citation.zotero.connected")
                    : t("citation.zotero.disconnected")}
              </Badge>
            </div>
          </DialogHeader>

          <div className="flex shrink-0 items-center justify-between gap-4 border-b bg-muted/30 px-6 py-3">
            <div className="text-sm text-muted-foreground">
              {t("citation.zotero.local_api")}
            </div>

            <Button
              variant="outline"
              size="sm"
              disabled={zoteroLoading}
              onClick={refreshZoteroConnection}
            >
              {zoteroLoading
                ? t("citation.zotero.refreshing")
                : t("citation.zotero.refresh")}
            </Button>
          </div>

          {zoteroError && (
            <div className="mx-6 mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {zoteroError}
            </div>
          )}

          <div className="flex-1 overflow-hidden px-6 py-4">
            <div className="flex h-full flex-col overflow-hidden rounded-xl border bg-background">
              <div className="grid shrink-0 grid-cols-[1fr_120px_100px_70px] gap-4 border-b px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <div>{t("citation.zotero.title_column")}</div>
                <div>{t("citation.zotero.type_column")}</div>
                <div>{t("citation.zotero.year_column")}</div>
                <div />
              </div>

              <ScrollArea className="flex-1 !overflow-scroll">
                {zoteroLoading ? (
                  <div className="p-6 text-sm text-muted-foreground">
                    {t("citation.zotero.loading")}
                  </div>
                ) : zoteroItems.length === 0 ? (
                  <div className="p-6 text-sm text-muted-foreground">
                    {t("citation.zotero.empty")}
                  </div>
                ) : (
                  zoteroItems.map((item) => (
                    <div
                      key={item.key}
                      className="grid grid-cols-[1fr_120px_100px_70px] items-center gap-4 border-b px-4 py-3 transition hover:bg-muted/40"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">
                          {item.title || item.key}
                        </div>

                        <div className="mt-1 truncate font-mono text-xs text-muted-foreground">
                          {item.key}
                        </div>
                      </div>

                      <div>
                        <Badge variant="secondary" className="rounded-md">
                          {item.itemType ?? t("citation.zotero.reference")}
                        </Badge>
                      </div>

                      <div className="text-sm text-muted-foreground">
                        {item.date || "-"}
                      </div>

                      <div className="flex justify-end">
                        <Checkbox
                          checked={selectedZoteroIds.includes(item.key)}
                          onCheckedChange={() =>
                            toggleZoteroSelection(item.key)
                          }
                        />
                      </div>
                    </div>
                  ))
                )}
              </ScrollArea>
            </div>
          </div>

          <DialogFooter className="shrink-0 border-t px-6 py-4">
            <Button variant="outline" onClick={() => setIsZoteroOpen(false)}>
              {t("common.cancel")}
            </Button>

            <Button
              onClick={importSelectedZoteroItems}
              disabled={zoteroLoading || zoteroItems.length === 0}
            >
              {t("citation.zotero.import_selected")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

type CitationRowProps = {
  cite: CiteUtils;
  onDelete: (id: string) => void;
  onCopy: (text: string) => void;
};

const CitationRow = ({ cite, onDelete, onCopy }: CitationRowProps) => {
  return (
    <div className="group flex items-start justify-between gap-4 px-4 py-4 transition hover:bg-neutral-50 dark:hover:bg-neutral-900/40">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Quote className="h-4 w-4 shrink-0 text-neutral-400" />

          <div className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
            {cite.getId()}
          </div>
        </div>

        <div className="mt-2 pl-6">
          <div className="truncate text-sm text-neutral-500 dark:text-neutral-400">
            {cite.getTitle()}
          </div>

          <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/40">
            <pre className="break-all whitespace-pre-wrap text-[11px] leading-relaxed text-neutral-500 dark:text-neutral-400">
              {cite.toCite()}
            </pre>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
        <button
          type="button"
          onClick={() => onCopy(cite.toCite())}
          className="flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-neutral-100 dark:hover:bg-neutral-800"
          aria-label={t("citation.copy")}
          title={t("citation.copy")}
        >
          <Copy className="h-4 w-4 text-neutral-500" />
        </button>

        <button
          type="button"
          onClick={() => onDelete(cite.getId())}
          className="flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-red-50 dark:hover:bg-red-900/20"
          aria-label={t("citation.delete")}
          title={t("citation.delete")}
        >
          <Trash className="h-4 w-4 text-neutral-500 hover:text-red-500" />
        </button>
      </div>
    </div>
  );
};
