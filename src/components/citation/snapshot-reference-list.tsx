import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import type { SnapshotReadModel } from "@/review/snapshot-reader";
import { citationUsageIndex, type UsageLocation } from "@/editor/document/reference-usage";
import { parseBibtexInput } from "@/utils/citation";
import { citationSearchFields, createCitationSearch } from "@/utils/citation-search";
import { useAppLanguage } from "@/hooks/use-app-language";
import { t } from "@/utils/lang";
import { EditorCitationList } from "./editor-citation-list";

export function SnapshotReferenceList({ snapshot, onNavigate }: {
  snapshot: SnapshotReadModel;
  onNavigate(location: UsageLocation): void;
}) {
  useAppLanguage();
  const [query, setQuery] = useState("");
  const { citations, failed } = useMemo(() => {
    let failed = false;
    const citations = Object.entries(snapshot.references).flatMap(([key, bib]) => {
      const citation = parseBibtexInput(bib).entries[0]?.cite;
      if (!citation) failed = true;
      return citation ? [citation.setId(key)] : [];
    });
    return { citations, failed };
  }, [snapshot]);
  const search = useMemo(() => createCitationSearch(citations, citationSearchFields), [citations]);
  const usage = useMemo(() => ({ byKey: citationUsageIndex(snapshot.chapters), status: "ready" as const }), [snapshot]);
  const filtered = useMemo(() => search(query), [search, query]);

  return <section data-snapshot-reference-list className="space-y-4">
    <Input type="search" value={query} onChange={event => setQuery(event.target.value)}
      aria-label={t("citation.search_hint")} placeholder={t("citation.search_hint")} />
    {failed && <p role="alert" className="text-sm text-destructive">{t("citation.load_failed")}</p>}
    {!filtered.length && <p className="text-sm text-muted-foreground">{t("usage.empty")}</p>}
    <EditorCitationList citations={filtered} usage={usage} onNavigateUsage={onNavigate} />
  </section>;
}
