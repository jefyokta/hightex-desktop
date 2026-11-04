import { memo, useMemo } from "react";
import type { CiteUtils } from "bibtex.js";
import { Copy, Quote, Trash } from "lucide-react";
import { t, useAppLanguage } from "@/utils/lang";
import { toast } from "sonner";

const copyCitation = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(t("citation.copied"));
  } catch {
    toast.error(t("citation.copy_failed"));
  }
};

type CitationRowProps = {
  cite: CiteUtils;
  onDelete: (id: string) => void;
  onCopy: (text: string) => void;
};

export const CitationList = memo(function CitationList({
  cites,
  onDelete,
}: Omit<CitationRowProps, "cite" | "onCopy"> & { cites: CiteUtils[] }) {
  useAppLanguage();
  return (
    <div className="h-full divide-y divide-muted/40 overflow-y-auto rounded-xl">
      {cites.map((cite) => (
        <div
          data-tour="reference-library"
          key={cite.getId()}
          className="px-3 py-2 transition hover:bg-muted/30"
        >
          <CitationRow cite={cite} onDelete={onDelete} onCopy={copyCitation} />
        </div>
      ))}
    </div>
  );
});

const CitationRow = ({ cite, onDelete, onCopy }: CitationRowProps) => {
  const citation = useMemo(() => cite.toCite(), [cite]);

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

          <div className="mt-3 border-l border-neutral-200 pl-3 dark:border-neutral-800">
            <pre className="break-all whitespace-pre-wrap text-[11px] leading-relaxed text-neutral-500 dark:text-neutral-400">
              {citation}
            </pre>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
        <button
          type="button"
          onClick={() => onCopy(citation)}
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
