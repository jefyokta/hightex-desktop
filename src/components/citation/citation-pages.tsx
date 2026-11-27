import { useEffect, useRef, useState, type ReactNode } from "react";
import type { CiteUtils } from "bibtex.js";
import { Button } from "@/components/ui/button";
import { useAppLanguage } from "@/hooks/use-app-language";
import { t } from "@/utils/lang";

/** Keep bibliography formatting and usage controls bounded while searching the complete catalog. */
export function CitationPages({ citations, children }: {
  citations: CiteUtils[];
  children(page: CiteUtils[]): ReactNode;
}) {
  useAppLanguage();
  const [page, setPage] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => setPage(0), [citations]);
  const size = 50;
  const current = Math.min(page, Math.max(0, Math.ceil(citations.length / size) - 1));
  const start = current * size;
  const navigate = (next: number) => {
    setPage(next);
    root.current?.scrollIntoView({ block: "start" });
  };
  return <div ref={root}>
    {children(citations.slice(start, start + size))}
    {citations.length > size && <nav aria-label={t("citation.title")} className="flex flex-wrap items-center justify-between gap-2 border-t py-3">
      <span role="status" className="text-xs text-muted-foreground">{t("citation.page_range", {
        from: start + 1, to: Math.min(start + size, citations.length), total: citations.length,
      })}</span>
      <div className="flex gap-1">
        <Button type="button" variant="ghost" size="sm" disabled={current === 0} onClick={() => navigate(current - 1)}>{t("citation.previous_page")}</Button>
        <Button type="button" variant="ghost" size="sm" disabled={start + size >= citations.length} onClick={() => navigate(current + 1)}>{t("citation.next_page")}</Button>
      </div>
    </nav>}
  </div>;
}
