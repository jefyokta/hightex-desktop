import { useEffect, useMemo, useState } from "react";
import { Copy, Search, Check, BookMarked, ChevronDown } from "lucide-react";

//@ts-ignore
import Cite from "citation-js";

import { Storage } from "@/editor/storage";
import { TabHeader } from "./components/tab-header";

import { CiteUtils } from "bibtex.js";
import { Dropdown } from "@/components/dropdown";

type CopyType = "cite-a" | "cite";

export const Citation = () => {
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");

  const [cites, setCites] = useState<CiteUtils[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);

        const data = await Storage.instance.getCites();

        setCites(data);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();

    if (!q) return cites;

    return cites.filter((cite) => {
      const qLower = q.toLowerCase();

      const data = cite.getCite();
      const authors = data?.author || data?.authors;

      let authorText = "";

      if (Array.isArray(authors)) {
        authorText = authors
          .map((a: any) =>
            typeof a === "string"
              ? a
              : `${a.given ?? ""} ${a.family ?? ""}`.trim(),
          )
          .join(" ");
      } else if (typeof authors === "string") {
        authorText = authors;
      }

      const title = (cite.getTitle() || "").toLowerCase();

      const full = (cite.toCite() || "").toLowerCase();

      const authorLower = authorText.toLowerCase();

      return (
        title.includes(qLower) ||
        full.includes(qLower) ||
        authorLower.includes(qLower)
      );
    });
  }, [query, cites]);

  return (
    <div className="flex h-full flex-col bg-background">
      <TabHeader title="Citation" desc="All citations saved on your computer" />

      <div className="border-b p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search citation..."
            className="h-10 w-full rounded-xl border bg-background pl-10 pr-4 text-sm outline-none transition focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 pb-20">
        {loading && (
          <div className="space-y-3">
            {Array.from({
              length: 5,
            }).map((_, i) => (
              <div key={i} className="rounded-2xl border p-4">
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

            <h2 className="mt-4 text-sm font-medium">No citations found</h2>

            <p className="mt-1 text-xs text-muted-foreground">
              Try another keyword.
            </p>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="space-y-4">
            {filtered.map((cite) => (
              <CitationItem key={cite.getId()} cite={cite} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const CitationItem = ({ cite }: { cite: CiteUtils }) => {
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
            {title || "Untitled Citation"}
          </h2>

          <p className="mt-1 text-xs text-muted-foreground">{author}</p>
        </div>

        <div className="flex items-center">
          <button
            onClick={() => copy("cite-a")}
            className="inline-flex h-8 items-center justify-center gap-1 rounded-l-lg border border-r-0 bg-background px-2.5 text-[11px] transition hover:bg-muted"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                Copy
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
                onClick={() => copy("cite-a")}
                className="flex w-full items-center rounded-lg px-3 py-2 text-left transition hover:bg-muted"
              >
                Copy Cite A
              </button>

              <button
                onClick={() => copy("cite")}
                className="flex w-full items-center rounded-lg px-3 py-2 text-left transition hover:bg-muted"
              >
                Copy Cite
              </button>
            </div>
          </Dropdown>
        </div>
      </div>

      <div className="mt-4 rounded-xl border bg-muted/30 p-3">
        <p className="wrap-break-word text-xs leading-6 whitespace-pre-wrap">
          {biblio}
        </p>
      </div>
    </div>
  );
};
