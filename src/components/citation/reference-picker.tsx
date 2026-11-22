import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useReferencePicker } from "@/hooks/use-reference-picker";
import { t } from "@/utils/lang";

export interface ReferencePickerHandle {
  onKeyDown(event: KeyboardEvent): boolean;
}
export interface ReferencePickerProps {
  query: string;
  zotero?: ConfigShape["zotero"];
  selectedKeys?: readonly string[];
  autoFocus?: boolean;
  onQueryChange?(query: string): void;
  onDismiss?(): void;
  onChoose(key: string): void;
}

/** Used by caret suggestions and the searchable picker, with immediate local results. */
export const ReferencePicker = forwardRef<ReferencePickerHandle, ReferencePickerProps>(function ReferencePicker(
  { query, zotero, selectedKeys = [], autoFocus = false, onQueryChange, onDismiss, onChoose }, ref,
) {
  const {
    results, active, busy, loading, statusMessage, canRetry, retry, choose, onKeyDown,
  } = useReferencePicker({ query, zotero, onChoose });
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [active]);

  useImperativeHandle(ref, () => ({ onKeyDown }));

  return (
    <div data-reference-picker className="flex max-h-[calc(100dvh-24px)] min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg">
      {onQueryChange && (
        <div className="relative shrink-0 border-b p-2">
          <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input type="search" value={query} autoFocus={autoFocus} onChange={event => onQueryChange(event.target.value)}
            aria-label={t("citation.search_hint")} placeholder={t("citation.search_hint")}
            className="pl-8"
            onKeyDown={event => {
              if (event.nativeEvent.isComposing) return;
              if (event.key === "Escape" && onDismiss) {
                event.preventDefault();
                event.stopPropagation();
                onDismiss();
              } else if (onKeyDown(event.nativeEvent)) {
                event.preventDefault();
                event.stopPropagation();
              }
            }} />
        </div>
      )}
      <div ref={list} role="listbox" aria-label={t("editor.inline.citation_choose")} aria-busy={busy || loading} className="max-h-72 min-h-0 overflow-y-auto p-1">
        {results.map((result, index) => (
          <button type="button" role="option" aria-selected={index === active} disabled={busy}
            key={`${result.source}:${result.key}`}
            onMouseDown={event => event.preventDefault()}
            onClick={() => void choose(result)}
            className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${index === active ? "bg-accent" : "hover:bg-accent/50"}`}>
            <span className="flex items-center gap-2" title={result.title}>
              <span className="min-w-0 flex-1 truncate font-medium">{result.title}</span>
              {result.source === "local" && selectedKeys.includes(result.key) && <span className="shrink-0 text-xs text-muted-foreground">{t("editor.inline.citation_added")}</span>}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {result.description}
            </span>
          </button>
        ))}
        {!results.length && !loading && <p className="p-3 text-sm text-muted-foreground">{t("editor.inline.citation_none")}</p>}
      </div>
      {statusMessage && (
        <div role="status" className="flex shrink-0 items-center justify-between gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
          <span>{t(statusMessage)}</span>
          {canRetry && <button type="button" onClick={retry} className="shrink-0 underline">{t("dashboard.retry")}</button>}
        </div>
      )}
    </div>
  );
});
