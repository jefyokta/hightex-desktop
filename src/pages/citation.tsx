import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { HighTexDB } from "../editor/storage/hightex-db";
import { CiteUtils } from "bibtex.js";
import { parseBibtexInput, isCitationValid } from "@/utils/citation";
import { DEFAULT_ZOTERO_CONFIG, type ZoteroItem } from "@/utils/zotero";

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

import { Search, Trash, Copy, Quote, Plus } from "lucide-react";
import { Zotero } from "@/assets/icons/zotero";
import { Input } from "@/components/ui/input";

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
    return rows.map((c) => new CiteUtils(c.bib).setId(c.key));
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
    if (!query.trim()) return citations;

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
    setCitations((prev) => prev.filter((c) => c.getId() !== id));
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

  const ensureUniqueKey = async (key: string, existing: Set<string>) => {
    let candidate = key;
    let suffix = 1;

    while (existing.has(candidate)) {
      candidate = `${key}_${suffix}`;
      suffix += 1;
    }

    existing.add(candidate);

    return candidate;
  };

  const importBibtexContent = async (content: string, openModal = false) => {
    setFeedback(null);
    setFeedbackType(null);

    if (!content.trim()) {
      setFeedback("No BibTeX content provided.");
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
        invalidEntries.length
          ? "No valid citations found."
          : "No citations parsed.",
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
      `Imported ${citationsToSave.length} citation(s)${
        invalidEntries.length
          ? `, skipped ${invalidEntries.length} invalid`
          : ""
      }.`,
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

      setZoteroError("Local Zotero integration is disabled in settings.");

      return false;
    }

    setZoteroLoading(true);
    setZoteroError(null);

    try {
      const result = await window.zotero.testConnection(host, port);

      if (!result?.connected) {
        setZoteroConnected(false);

        setZoteroError(
          result?.message ?? "Unable to connect to Zotero local API.",
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
        setZoteroError("No Zotero references found.");
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
    setSelectedZoteroIds((prev) =>
      prev.includes(key) ? prev.filter((id) => id !== key) : [...prev, key],
    );
  };

  const importSelectedZoteroItems = async () => {
    if (selectedZoteroIds.length === 0) {
      setZoteroError("Select at least one Zotero reference.");

      return;
    }

    const selectedItems = zoteroItems.filter((item) =>
      selectedZoteroIds.includes(item.key),
    );

    if (!selectedItems.length) {
      setZoteroError("No matching Zotero references.");

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
        setZoteroError("No valid references imported.");

        return;
      }

      const mapped = await loadCitations();

      setCitations(mapped);

      setFeedback(`Imported ${importedCount} reference(s).`);
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
          Loading citations...
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col p-6 max-w-3xl mx-auto flex-1">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 min-h-0">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Citation Library
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            Manage bibliography references and import directly from Zotero.
          </p>
        </div>

        {/* <Stats total={citations.length} /> */}

        <div className="flex flex-1 min-h-0 flex-col rounded-2xl bg-muted/20 overflow-hidden">
          <div className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between shrink-0">
            <div className="text-sm font-medium">Bibliography Actions</div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setIsAddOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Citation
              </Button>

              <Button variant="outline" onClick={openZoteroImport}>
                <Zotero className="mr-2 h-2 w-2" />
                Import from Zotero
              </Button>
            </div>
          </div>

          <div className="px-4 pb-3 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search from ${citations.length} citations...`}
                className="h-10 w-full rounded-xl border-0 bg-background/70 pl-10 pr-4 text-sm outline-none ring-1 ring-transparent transition focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div className="flex-1 min-h-0 px-2 pb-2 overflow-hidden">
            {filtered.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-xl text-sm text-muted-foreground">
                No citations available.
              </div>
            ) : (
              <div className="h-full overflow-y-auto rounded-xl divide-y divide-muted/40">
                {filtered.map((cite) => (
                  <div
                    key={cite.getId()}
                    className="px-3 py-2 hover:bg-muted/30 transition"
                  >
                    <Row
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
          className="max-w-none! w-[70vw] h-[85vh] flex flex-col overflow-hidden"
        >
          <DialogHeader className="border-b px-6 py-5 flex-none">
            <DialogTitle>Import Citation</DialogTitle>

            <DialogDescription>
              Paste BibTeX content or upload a .bib file.
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 py-4 border-b flex items-center justify-between gap-3 flex-none">
            <label className="text-sm font-medium">BibTeX Content</label>

            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border bg-background px-3 py-2 text-xs font-medium transition hover:bg-muted">
              Upload .bib
              <input
                type="file"
                accept=".bib,application/x-bibtex,text/x-bibtex"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
          </div>

          <div className="flex-1 min-h-0 px-6 py-5 flex flex-col gap-4 overflow-hidden">
            <Textarea
              value={bibText}
              onChange={(e) => setBibText(e.target.value)}
              placeholder="@article{...}"
              className="flex-1 min-h-0 resize-none font-mono text-sm"
            />

            <div className="flex items-center justify-between rounded-xl border bg-muted/30 px-4 py-3 text-sm flex-none">
              <div className="text-muted-foreground">
                Only valid citations with title, year, and author/editor are
                imported.
              </div>

              <Badge variant="secondary">BibTeX</Badge>
            </div>

            {feedback && (
              <div
                className={`rounded-xl border px-4 py-3 text-sm flex-none ${
                  feedbackType === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
                }`}
              >
                {feedback}
              </div>
            )}
          </div>

          <DialogFooter className="border-t px-6 py-4 flex-none">
            <Button variant="outline" onClick={closeModal}>
              Cancel
            </Button>

            <Button onClick={addCitation}>Import citations</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isZoteroOpen} onOpenChange={setIsZoteroOpen}>
        <DialogContent
          showCloseButton
          className="max-w-none! w-[70vw] h-[85vh] flex flex-col gap-0 overflow-hidden"
        >
          <DialogHeader className="border-b px-6 py-4 shrink-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <DialogTitle className="text-xl">
                  Import from Zotero
                </DialogTitle>

                <DialogDescription className="mt-1">
                  Browse and import references directly from your local Zotero
                  library.
                </DialogDescription>
              </div>

              <Badge
                variant={zoteroConnected ? "default" : "destructive"}
                className="mt-1"
              >
                {zoteroConnected === null
                  ? "Checking"
                  : zoteroConnected
                    ? "Connected"
                    : "Disconnected"}
              </Badge>
            </div>
          </DialogHeader>

          <div className="border-b px-6 py-3 flex items-center justify-between gap-4 shrink-0 bg-muted/30">
            <div className="text-sm text-muted-foreground">
              Zotero Local API
            </div>

            <Button
              variant="outline"
              size="sm"
              disabled={zoteroLoading}
              onClick={refreshZoteroConnection}
            >
              {zoteroLoading ? "Refreshing..." : "Refresh"}
            </Button>
          </div>

          {zoteroError && (
            <div className="mx-6 mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {zoteroError}
            </div>
          )}

          <div className="flex-1 overflow-hidden px-6 py-4">
            <div className="h-full overflow-hidden rounded-xl border bg-background flex flex-col">
              <div className="grid grid-cols-[1fr_120px_100px_70px] gap-4 border-b px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground shrink-0">
                <div>Title</div>
                <div>Type</div>
                <div>Year</div>
                <div></div>
              </div>

              <ScrollArea className="flex-1">
                {zoteroLoading ? (
                  <div className="p-6 text-sm text-muted-foreground">
                    Loading references...
                  </div>
                ) : zoteroItems.length === 0 ? (
                  <div className="p-6 text-sm text-muted-foreground">
                    No references found.
                  </div>
                ) : (
                  zoteroItems.map((item) => (
                    <div
                      key={item.key}
                      className="grid grid-cols-[1fr_120px_100px_70px] gap-4 items-center border-b px-4 py-3 hover:bg-muted/40 transition"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">
                          {item.title || item.key}
                        </div>

                        <div className="mt-1 text-xs text-muted-foreground font-mono truncate">
                          {item.key}
                        </div>
                      </div>

                      <div>
                        <Badge variant="secondary" className="rounded-md">
                          {item.itemType ?? "Reference"}
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

          <DialogFooter className="border-t px-6 py-4 shrink-0">
            <Button variant="outline" onClick={() => setIsZoteroOpen(false)}>
              Cancel
            </Button>

            <Button
              onClick={importSelectedZoteroItems}
              disabled={zoteroLoading || zoteroItems.length === 0}
            >
              Import Selected
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const Row = ({ cite, onDelete, onCopy }: any) => {
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
          <div className="text-sm text-neutral-500 dark:text-neutral-400 truncate">
            {cite.getTitle()}
          </div>

          <div className="mt-3 rounded-xl bg-neutral-50 dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800 p-3">
            <pre className="text-[11px] leading-relaxed text-neutral-500 dark:text-neutral-400 whitespace-pre-wrap break-all">
              {cite.toCite()}
            </pre>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
        <button
          onClick={() => onCopy(cite.toCite())}
          className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
        >
          <Copy className="h-4 w-4 text-neutral-500" />
        </button>

        <button
          onClick={() => onDelete(cite.getId())}
          className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition"
        >
          <Trash className="h-4 w-4 text-neutral-500 hover:text-red-500" />
        </button>
      </div>
    </div>
  );
};
