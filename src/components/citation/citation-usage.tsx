import { useState } from "react";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { UsageLocation } from "@/editor/document/reference-usage";
import { useAppLanguage } from "@/hooks/use-app-language";
import { t } from "@/utils/lang";

export interface ReferenceUsageView {
  byKey: ReadonlyMap<string, readonly UsageLocation[]>;
  status: "loading" | "ready" | "error";
  retry?(): void;
}

export function CitationUsage({ referenceKey, usage, onNavigate }: {
  referenceKey: string;
  usage?: ReferenceUsageView;
  onNavigate?(location: UsageLocation): void;
}) {
  useAppLanguage();
  const [open, setOpen] = useState(false);
  if (!usage) return null;
  if (usage.status === "loading")
    return <p role="status" className="mt-3 text-xs text-muted-foreground">{t("usage.loading")}</p>;
  if (usage.status === "error")
    return <div role="alert" className="mt-3 text-xs text-muted-foreground">
      {t("usage.failed")}
      {usage.retry && <Button size="sm" variant="link" onClick={usage.retry}>{t("dashboard.retry")}</Button>}
    </div>;

  const locations = usage.byKey.get(referenceKey) ?? [];
  if (!locations.length)
    return <p data-citation-usage="0" className="mt-3 text-xs text-muted-foreground">{t("usage.unused")}</p>;

  return <Collapsible open={open} onOpenChange={setOpen} data-citation-usage={locations.length} className="mt-3">
    <CollapsibleTrigger asChild>
      <Button size="sm" variant="ghost" className="h-auto gap-1.5 px-0 text-xs text-muted-foreground">
        {t("usage.count", { count: locations.length })}
        <ChevronDown className={`size-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </Button>
    </CollapsibleTrigger>
    <CollapsibleContent>
      <ul className="mt-2 space-y-2 border-l pl-3">
        {locations.map((location, index) => {
          const details = <div className="min-w-0 flex-1">
            {location.documentTitle && <p className="text-xs font-medium">{location.documentTitle}</p>}
            <p className="text-xs">{location.chapterTitle}</p>
            {location.excerpt && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{location.excerpt}</p>}
          </div>;
          return <li key={`${location.chapterId}:${location.path.join(".")}:${index}`}>
            {onNavigate ? <Button size="sm" variant="ghost" onClick={() => onNavigate(location)}
              className="h-auto w-full justify-start gap-2 px-2 py-2 text-left whitespace-normal">
              {details}<ArrowUpRight className="size-3 shrink-0" />
            </Button> : details}
          </li>;
        })}
      </ul>
    </CollapsibleContent>
  </Collapsible>;
}
