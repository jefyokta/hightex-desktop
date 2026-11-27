import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { CiteUtils } from "bibtex.js";
import { Check, ChevronDown, Copy, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAppLanguage } from "@/hooks/use-app-language";
import { formatCitationBibliography } from "@/utils/citation";
import { t } from "@/utils/lang";
import { CitationUsage, type ReferenceUsageView } from "./citation-usage";
import type { UsageLocation } from "@/editor/document/reference-usage";
import { CitationPages } from "./citation-pages";

interface Props {
  citations: CiteUtils[];
  onEdit?(citation: CiteUtils): void;
  usage?: ReferenceUsageView;
  onNavigateUsage?(location: UsageLocation): void;
}

type CopyStyle = "narrative" | "parenthetical";

// Keep author-form keystrokes from reformatting every bibliography entry.
export const EditorCitationList = memo(function EditorCitationList({ citations, onEdit, usage, onNavigateUsage }: Props) {
  useAppLanguage();
  return (
    <CitationPages citations={citations}>{page => (
    <div className="space-y-4">
      {page.map(citation => <CitationCard key={citation.getId()} citation={citation} onEdit={onEdit} usage={usage} onNavigateUsage={onNavigateUsage} />)}
    </div>
    )}</CitationPages>
  );
});

function CitationCard({ citation, onEdit, usage, onNavigateUsage }: Omit<Props, "citations"> & { citation: CiteUtils }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);
  const presentation = useMemo(() => ({
    title: citation.getTitle(),
    author: citation.toCiteA(),
    bibliography: formatCitationBibliography(citation),
  }), [citation]);

  const copy = async (style: CopyStyle) => {
    try {
      const prefix = style === "narrative" ? "a" : "n";
      await navigator.clipboard.writeText(`\\cite.${prefix}.${citation.getId()}`);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("citation.copy_failed"));
    }
  };

  return (
    <article data-citation-key={citation.getId()} className="rounded-2xl border bg-background p-4 transition hover:bg-muted/20">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold">{presentation.title || t("editor.expandable.citation.untitled")}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{presentation.author}</p>
        </div>
        <div className="flex shrink-0 items-center">
          <Button size="sm" variant="outline" className="rounded-r-none border-r-0 text-[11px]"
            onClick={() => void copy("narrative")}>
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
            {t(copied ? "editor.expandable.citation.copied" : "editor.expandable.citation.copy")}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon-sm" variant="outline" className="rounded-l-none"
                aria-label={t("editor.expandable.citation.copy")}>
                <ChevronDown className="size-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => void copy("narrative")}>
                {t("editor.expandable.citation.copy_cite_a")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void copy("parenthetical")}>
                {t("editor.expandable.citation.copy_cite")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="mt-4 rounded-xl border bg-muted/30 p-3">
        <p className="wrap-break-word whitespace-pre-wrap text-xs leading-6">{presentation.bibliography}</p>
      </div>
      {onEdit && <Button type="button" variant="ghost" size="sm" onClick={() => onEdit(citation)}
        className="mt-3 h-auto px-0 text-xs text-muted-foreground hover:bg-transparent hover:text-foreground">
        <Pencil className="size-3" />{t("editor.expandable.citation.edit_authors")}
      </Button>}
      <CitationUsage referenceKey={citation.getId()} usage={usage} onNavigate={onNavigateUsage} />
    </article>
  );
}
