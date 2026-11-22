import { useMemo, useState } from "react";
import { ArrowUpRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAppLanguage } from "@/hooks/use-app-language";
import type { ReferenceUsageEntry, UsageKind, UsageLocation } from "@/editor/document/reference-usage";
import { t, type LocaleKey } from "@/utils/lang";

const kinds: Record<UsageKind, LocaleKey> = {
  citation: "usage.citation", imageFigure: "usage.image", figureTable: "usage.table",
  equation: "usage.equation", head: "usage.heading",
};

export function ReferenceUsagePanel({ entries, onNavigate, initialKey }: {
  entries: ReferenceUsageEntry[];
  initialKey?: string;
  onNavigate?(location: UsageLocation): void;
}) {
  useAppLanguage();
  const [query, setQuery] = useState(initialKey ?? "");
  const filtered = useMemo(() => entries.filter(entry =>
    `${entry.title} ${entry.key}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  ), [entries, query]);

  return (
    <section data-reference-usage className="flex min-h-0 flex-col gap-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
        <Input type="search" className="pl-9" value={query} onChange={event => setQuery(event.target.value)}
          aria-label={t("usage.search")} placeholder={t("usage.search")} />
      </div>
      <div className="min-h-0 space-y-3 overflow-y-auto">
        {!filtered.length && <p className="p-5 text-center text-sm text-muted-foreground">{t("usage.empty")}</p>}
        {filtered.map(entry => (
          <article key={`${entry.kind}:${entry.key}`} className="rounded-xl border bg-background p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="text-xs text-muted-foreground">{t(kinds[entry.kind])}</span>
                <h3 className="break-words text-sm font-medium">{entry.title}</h3>
              </div>
              <span className="shrink-0 rounded-md bg-muted px-2 py-1 text-xs tabular-nums">{entry.occurrences.length}</span>
            </div>
            {!entry.occurrences.length && <p className="mt-3 text-xs text-muted-foreground">{t("usage.unused")}</p>}
            <ul className="mt-2 space-y-1">
              {entry.occurrences.map((location, index) => (
                <li key={`${location.chapterId}:${location.path.join(".")}:${index}`}>
                  <Button variant="ghost" disabled={!onNavigate} onClick={() => onNavigate?.(location)}
                    className="h-auto w-full justify-start px-2 py-2 text-left whitespace-normal">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium">{location.chapterTitle}</p>
                      <p className="mt-1 line-clamp-2 text-xs font-normal text-muted-foreground">{location.excerpt || entry.key}</p>
                    </div>
                    {onNavigate && <ArrowUpRight className="size-3.5 shrink-0" />}
                  </Button>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
