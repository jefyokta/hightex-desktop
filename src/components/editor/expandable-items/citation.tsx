import { useEffect, useMemo, useState } from "react";
import { Copy, Search, Check, BookMarked, ChevronDown, Plus, Pencil, X } from "lucide-react";

// @ts-ignore
import Cite from "citation-js";

import { TabHeader } from "./components/tab-header";

import { CiteUtils, objectToBib } from "bibtex.js";
import { Dropdown } from "@/components/dropdown";
import { HighTexDB } from "@/editor/storage/hightex-db";
import { t } from "@/utils/lang";
import { parseBibtexInput, isCitationValid } from "@/utils/citation";
import { DEFAULT_ZOTERO_CONFIG, type ZoteroItem } from "@/utils/zotero";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Zotero } from "@/assets/icons/zotero";

type CopyType = "cite-a" | "cite";
type AuthorInput = { firstName: string; lastName: string } | string;

const getAuthorInputs = (cite: CiteUtils): AuthorInput[] => {
  const authors = (cite.getCite() as any).author;
  const list = Array.isArray(authors) ? authors : authors ? [authors] : [];
  return list.map((author: any) => {
    if (typeof author === "string") return author;
    if (author.literal) return String(author.literal);
    if (!author.given) return String(author.family || "");
    return { firstName: String(author.given), lastName: String(author.family || "") };
  });
};

export const Citation = () => {
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [cites, setCites] = useState<CiteUtils[]>([]);
  const [mode, setMode] = useState<"bibtex" | "zotero" | null>(null);
  const [bibText, setBibText] = useState("");
  const [zoteroItems, setZoteroItems] = useState<ZoteroItem[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<CiteUtils | null>(null);
  const [authors, setAuthors] = useState<AuthorInput[]>([]);

  const db = HighTexDB.getInstance();
  const reload = async () => setCites(await db.getCites());

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);

        await reload();
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();

    if (!q) {
      return cites;
    }

    return cites.filter((cite) => {
      const data = cite.getCite();
      const authors = data?.author || data?.authors;

      let authorText = "";

      if (Array.isArray(authors)) {
        authorText = authors
          .map((author: any) =>
            typeof author === "string"
              ? author
              : `${author.given ?? ""} ${author.family ?? ""}`.trim(),
          )
          .join(" ");
      } else if (typeof authors === "string") {
        authorText = authors;
      }

      const title = (cite.getTitle() || "").toLowerCase();
      const full = (cite.toCite() || "").toLowerCase();
      const authorLower = authorText.toLowerCase();

      return title.includes(q) || full.includes(q) || authorLower.includes(q);
    });
  }, [query, cites]);

  const importBib = async (content: string) => {
    const { entries, errors } = parseBibtexInput(content);
    if (errors.length) throw new Error(errors.join(" "));
    const valid = entries.filter((entry) => isCitationValid(entry.cite));
    if (!valid.length) throw new Error(t("citation.error.no_valid_citations"));
    const keys = new Set((await db.cite.toArray()).map((item) => item.key));
    const records = valid.map((entry) => {
      let key = entry.key;
      for (let index = 1; keys.has(key); index++) key = `${entry.key}_${index}`;
      keys.add(key);
      return { key, bib: entry.bib };
    });
    await db.cite.bulkPut(records);
    await reload();
    toast.success(t("citation.imported", { count: records.length, skipped: "" }));
    setMode(null);
    setBibText("");
  };

  const openZotero = async () => {
    setMode("zotero");
    setSelected([]);
    setZoteroItems([]);
    setBusy(true);
    try {
      await window.config.ready();
      const { enabled, host, port } = window.config.get()?.zotero ?? DEFAULT_ZOTERO_CONFIG;
      if (!enabled) throw new Error(t("citation.zotero.integration_disabled"));
      const result = await window.zotero.testConnection(host, port);
      if (!result.connected) throw new Error(result.message || t("citation.zotero.connection_failed"));
      setZoteroItems(await window.zotero.listItems(host, port, 100));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("citation.zotero.connection_failed"));
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      if (mode === "bibtex") await importBib(bibText);
      if (mode === "zotero") {
        await window.config.ready();
        const { host, port } = window.config.get()?.zotero ?? DEFAULT_ZOTERO_CONFIG;
        const bibs = await Promise.all(selected.map((key) => window.zotero.exportBibtex(host, port, key)));
        await importBib(bibs.join("\n\n"));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const saveAuthors = async () => {
    if (!editing) return;
    const values = authors.map((author) => typeof author === "string"
      ? author.trim()
      : { firstName: author.firstName.trim(), lastName: author.lastName.trim() });
    if (!values.length || values.some((author) => typeof author === "string"
      ? !author
      : !author.firstName && !author.lastName)) {
      return toast.error(t("editor.expandable.citation.author_required"));
    }
    try {
      const data = { ...editing.getCite(), author: values.map((author) => typeof author === "string"
        ? { literal: author }
        : { given: author.firstName, family: author.lastName }) };
      await db.cite.update(editing.getId(), { bib: objectToBib(data as any) });
      await reload();
      setEditing(null);
      toast.success(t("editor.expandable.citation.saved"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <TabHeader
        title={t("editor.expandable.citation.title")}
        desc={t("editor.expandable.citation.description")}
      />

      <div className="flex gap-2 border-b px-3 py-3">
        <Button size="sm" className="min-w-0 flex-1 gap-1.5 rounded-xl px-2 text-[11px] whitespace-nowrap" onClick={() => setMode("bibtex")}>
          <Plus className="h-4 w-4 shrink-0" />{t("citation.add")}
        </Button>
        <Button size="sm" variant="outline" className="min-w-0 flex-1 gap-1.5 rounded-xl px-2 text-[11px] whitespace-nowrap" onClick={openZotero}>
          <Zotero className="h-3.5 w-3.5 shrink-0 fill-current" />{t("citation.import_zotero")}
        </Button>
      </div>

      <div className="border-b p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("editor.expandable.citation.search")}
            className="h-10 w-full rounded-xl border bg-background pl-10 pr-4 text-sm outline-none transition focus:ring-2 focus:ring-ring"
          />
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

        {!loading && filtered.length === 0 && (
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

        {!loading && filtered.length > 0 && (
          <div className="space-y-4">
            {filtered.map((cite) => (
              <CitationItem key={cite.getId()} cite={cite} onEdit={() => {
                setEditing(cite);
                setAuthors(getAuthorInputs(cite));
              }} />
            ))}
          </div>
        )}
      </div>
      <Dialog open={mode !== null} onOpenChange={(open) => !open && setMode(null)}>
        <DialogContent className="max-h-[85vh] overflow-auto">
          <DialogHeader><DialogTitle>{mode === "bibtex" ? t("citation.import_title") : t("citation.zotero.title")}</DialogTitle></DialogHeader>
          {mode === "bibtex" ? <div className="space-y-3">
            <label className="block text-sm">{t("citation.upload_bib")}
              <input type="file" accept=".bib,application/x-bibtex,text/x-bibtex" className="mt-1 block w-full text-xs" onChange={async (event) => { const file = event.target.files?.[0]; if (file) setBibText(await file.text()); }} />
            </label>
            <textarea className="h-56 w-full rounded-lg border bg-background p-3 font-mono text-xs" value={bibText} onChange={(event) => setBibText(event.target.value)} placeholder={t("citation.bibtex_placeholder")} />
          </div> : <div className="max-h-80 space-y-1 overflow-auto">
            {busy ? t("citation.zotero.loading") : zoteroItems.length ? zoteroItems.map((item) => <label key={item.key} className="flex cursor-pointer gap-2 rounded-lg p-2 text-sm hover:bg-muted">
              <input type="checkbox" checked={selected.includes(item.key)} onChange={() => setSelected((current) => current.includes(item.key) ? current.filter((key) => key !== item.key) : [...current, item.key])} />
              <span>{item.title || item.key}</span>
            </label>) : t("citation.zotero.no_references")}
          </div>}
          <DialogFooter><Button variant="outline" onClick={() => setMode(null)}>{t("common.cancel")}</Button><Button disabled={busy || (mode === "zotero" ? !selected.length : !bibText.trim())} onClick={save}>{t("citation.import")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[85vh] overflow-auto">
          <DialogHeader><DialogTitle>{t("editor.expandable.citation.edit_authors")}</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">{t("editor.expandable.citation.author_hint")}</p>
          <div className="space-y-2">
            {authors.map((author, index) => <div key={index} className="flex items-start gap-2 rounded-lg border p-2">
              <div className="min-w-0 flex-1 space-y-2">
                {typeof author === "string" ? <input
                  aria-label={`${t("editor.expandable.citation.full_name")} ${index + 1}`}
                  placeholder={t("editor.expandable.citation.full_name")}
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  value={author}
                  onChange={(event) => setAuthors((current) => current.map((item, i) => i === index ? event.target.value : item))}
                /> : <div className="grid grid-cols-2 gap-2">
                  <input
                    aria-label={`${t("editor.expandable.citation.first_name")} ${index + 1}`}
                    placeholder={t("editor.expandable.citation.first_name")}
                    className="h-9 min-w-0 rounded-md border bg-background px-3 text-sm"
                    value={author.firstName}
                    onChange={(event) => setAuthors((current) => current.map((item, i) => i === index && typeof item !== "string" ? { ...item, firstName: event.target.value } : item))}
                  />
                  <input
                    aria-label={`${t("editor.expandable.citation.last_name")} ${index + 1}`}
                    placeholder={t("editor.expandable.citation.last_name")}
                    className="h-9 min-w-0 rounded-md border bg-background px-3 text-sm"
                    value={author.lastName}
                    onChange={(event) => setAuthors((current) => current.map((item, i) => i === index && typeof item !== "string" ? { ...item, lastName: event.target.value } : item))}
                  />
                </div>}
              </div>
              <button type="button" aria-label={`${t("editor.expandable.citation.remove_author")} ${index + 1}`} onClick={() => setAuthors((current) => current.filter((_, i) => i !== index))} className="rounded-md p-2 hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>)}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setAuthors((current) => [...current, { firstName: "", lastName: "" }])}><Plus className="mr-1 h-4 w-4" />{t("editor.expandable.citation.add_person")}</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setAuthors((current) => [...current, ""])}><Plus className="mr-1 h-4 w-4" />{t("editor.expandable.citation.add_name")}</Button>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEditing(null)}>{t("common.cancel")}</Button><Button onClick={saveAuthors}>{t("editor.expandable.citation.save")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

type CitationItemProps = {
  cite: CiteUtils;
  onEdit: () => void;
};

const CitationItem = ({ cite, onEdit }: CitationItemProps) => {
  const [copied, setCopied] = useState<CopyType | null>(null);

  const title = cite.getTitle();

  const biblio = new Cite(cite.getCite()).format("bibliography", {
    format: "text",
    template: "apa",
    lang: "id-ID",
  });

  const author = cite.toCiteA();

  const copy = async (type: CopyType) => {
    const text =
      type === "cite-a"
        ? `\\cite.a.${cite.getId()}`
        : `\\cite.n.${cite.getId()}`;

    await navigator.clipboard.writeText(text);

    setCopied(type);

    setTimeout(() => {
      setCopied(null);
    }, 2000);
  };

  return (
    <div className="rounded-2xl border bg-background p-4 transition hover:bg-muted/20">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold">
            {title || t("editor.expandable.citation.untitled")}
          </h2>

          <p className="mt-1 text-xs text-muted-foreground">{author}</p>
        </div>

        <div className="flex items-center">
          <button
            type="button"
            onClick={() => copy("cite-a")}
            className="inline-flex h-8 items-center justify-center gap-1 rounded-l-lg border border-r-0 bg-background px-2.5 text-[11px] transition hover:bg-muted"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3" />
                {t("editor.expandable.citation.copied")}
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                {t("editor.expandable.citation.copy")}
              </>
            )}
          </button>

          <Dropdown
            className="z-4000"
            align="right"
            trigger={
              <div className="flex h-8 w-8 items-center justify-center rounded-r-lg border bg-background transition hover:bg-muted">
                <ChevronDown className="h-3 w-3" />
              </div>
            }
          >
            <div className="min-w-40 p-1 text-xs">
              <button
                type="button"
                onClick={() => copy("cite-a")}
                className="flex w-full items-center rounded-lg px-3 py-2 text-left transition hover:bg-muted"
              >
                {t("editor.expandable.citation.copy_cite_a")}
              </button>

              <button
                type="button"
                onClick={() => copy("cite")}
                className="flex w-full items-center rounded-lg px-3 py-2 text-left transition hover:bg-muted"
              >
                {t("editor.expandable.citation.copy_cite")}
              </button>
            </div>
          </Dropdown>
        </div>
      </div>

      <div className="mt-4 rounded-xl border bg-muted/30 p-3">
        <p className="wrap-break-word whitespace-pre-wrap text-xs leading-6">
          {biblio}
        </p>
      </div>
      <button type="button" onClick={onEdit} className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><Pencil className="h-3 w-3" />{t("editor.expandable.citation.edit_authors")}</button>
    </div>
  );
};
