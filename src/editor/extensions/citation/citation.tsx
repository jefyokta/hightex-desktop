import { useConfig } from "@/hooks/use-config";
import { ReferencePicker } from "@/components/citation/reference-picker";
import { useAppLanguage } from "@/hooks/use-app-language";
import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { Plus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { ReferenceRepository } from "@/editor/storage/reference-repository";
import { citationFallback, resolveCitation } from "./resolve";
import { CiteUtils } from "bibtex.js";
import { t } from "@/utils/lang";
import { CitationPresentation, type CitationStatus } from "./presentation";

type CitationItemProps = {
  cite: CiteRecord;
  onRemove?: () => void;
};

const CitationItem = ({
  cite,
  onRemove,
}: CitationItemProps) => {
  const utils = new CiteUtils(cite.bib).setId(cite.key);

  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
          {utils.toCite()}
        </div>

        <div className="line-clamp-2 text-xs text-neutral-500 dark:text-neutral-400">
          {utils.getTitle()}
        </div>
      </div>

      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="
            shrink-0 rounded-md p-1
            text-neutral-400
            hover:bg-neutral-100 hover:text-neutral-700
            dark:hover:bg-neutral-800 dark:hover:text-neutral-200
          "
          aria-label={t("editor.inline.citation_remove")}
        >
          <X size={15} />
        </button>
      )}

    </div>
  );
};

export const Citation: React.FC<NodeViewProps> = ({
  node,
  updateAttributes,
}) => {
  useAppLanguage();
  const { config } = useConfig();
  const repository = useMemo(() => new ReferenceRepository(), []);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"view" | "add">("view");

  const [loaded, setLoaded] = useState<{
    ids: readonly string[];
    records: CiteRecord[];
    error?: boolean;
  }>();

  const [search, setSearch] = useState("");

  const citeIds = useMemo(
    () => node.attrs.cite?.split("|").filter(Boolean) ?? [],
    [node.attrs.cite],
  );

  useEffect(() => {
    let mounted = true;

    const loadCites = async () => {
      if (node.attrs.manual) {
        if (mounted) setLoaded({ ids: citeIds, records: [] });
        return;
      }
      try {
        const result = await repository.get(citeIds);
        if (mounted) setLoaded({ ids: citeIds, records: result });
      } catch {
        if (mounted) setLoaded({ ids: citeIds, records: [], error: true });
      }
    };
    void loadCites();

    return () => {
      mounted = false;
    };
  }, [citeIds, node.attrs.manual, repository]);

  const citation: { status: CitationStatus; text: string } = (() => {
    if (!node.attrs.manual && loaded?.ids !== citeIds)
      return { status: "loading", text: t("common.loading") };
    try {
      if (!node.attrs.manual && loaded?.error)
        throw Error("Citation unavailable");
      return {
        status: "ready",
        text: resolveCitation(node.attrs, loaded?.records ?? []),
      };
    } catch {
      return { status: "error", text: citationFallback(node.attrs.cite) };
    }
  })();
  const cites = loaded?.records ?? [];

  const addCitation = (id: string) => {
    if (citeIds.includes(id)) {
      return;
    }

    updateAttributes({
      cite: [...citeIds, id].join("|"),
    });
  };

  const removeCitation = (id: string) => {
    updateAttributes({
      cite: citeIds.filter((citeId: string) => citeId !== id).join("|"),
    });
  };


  return (
    <NodeViewWrapper as="span">
      <Popover
        modal
        open={open}
        onOpenChange={(value) => {
          setOpen(value);

          if (!value) {
            setMode("view");
            setSearch("");
          }
        }}
      >
        <PopoverTrigger asChild>
          <CitationPresentation
            data-cite={node.attrs.id}
            status={citation.status}
            text={citation.text}
          />
        </PopoverTrigger>

        <PopoverContent
          align="start"
          className="
            w-100 max-w-[calc(100vw-24px)] overflow-hidden rounded-xl border
            border-neutral-200 bg-white p-0 shadow-lg
            dark:border-neutral-700 dark:bg-neutral-900
          "
        >
          {mode === "add" ? (
            <>
              <div className="flex items-center gap-2 border-b px-4 py-3">
                <button
                  type="button"
                  onClick={() => {
                    setMode("view");
                    setSearch("");
                  }}
                  className="
                    rounded-md px-2 py-1 text-sm
                    text-neutral-500
                    hover:bg-neutral-100
                    dark:hover:bg-neutral-800
                  "
                >
                  ←
                </button>

                <div className="min-w-0">
                  <h2 className="text-sm font-semibold">
                    {t("editor.inline.citation_add")}
                  </h2>

                  <p className="truncate text-xs text-neutral-500">
                    {t("editor.inline.citation_choose")}
                  </p>
                </div>
              </div>

              <div className="p-3">
                {open && <ReferencePicker autoFocus query={search} onQueryChange={setSearch} zotero={config?.zotero} selectedKeys={citeIds} onChoose={addCitation} />}
              </div>
            </>
          ) : (
            <>
              <div className="border-b px-4 py-3">
                <h2 className="text-sm font-semibold">
                  {t("editor.inline.citation")}
                </h2>

                <p className="text-xs text-neutral-500">
                  {t("editor.inline.citation_manage")}
                </p>
              </div>

              <div className="p-3">
                {cites.length > 0 ? (
                  <div className="divide-y rounded-lg border border-neutral-200 dark:divide-neutral-700 dark:border-neutral-700">
                    {cites.map((cite) => (
                      <CitationItem
                        key={cite.key}
                        cite={cite}
                        onRemove={() => removeCitation(cite.key)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-neutral-300 px-3 py-8 text-center text-sm text-neutral-500 dark:border-neutral-700">
                    {t("editor.inline.citations_none")}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setMode("add")}
                  className="
                    mt-2 flex w-full items-center justify-center
                    gap-2 rounded-lg border border-dashed
                    border-neutral-300 px-3 py-2
                    text-sm text-neutral-600
                    transition-colors
                    hover:border-neutral-400 hover:bg-neutral-50
                    dark:border-neutral-700 dark:text-neutral-400
                    dark:hover:border-neutral-600 dark:hover:bg-neutral-800
                  "
                >
                  <Plus size={15} />
                  {t("editor.inline.citation_add")}
                </button>
              </div>

              <div className="border-t px-3 py-3">
                <div className="mb-2 px-1 text-xs font-medium text-neutral-500">
                  {t("editor.inline.citation_format")}
                </div>

                <Tabs
                  value={node.attrs.citeA ? "author" : "standard"}
                  onValueChange={(value) =>
                    updateAttributes({
                      citeA: value === "author",
                    })
                  }
                >
                  <TabsList className="grid h-9 w-full grid-cols-2">
                    <TabsTrigger value="standard">
                      {t("editor.inline.citation_standard")}
                    </TabsTrigger>

                    <TabsTrigger value="author">
                      {t("editor.inline.citation_author")}
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </>
          )}
        </PopoverContent>
      </Popover>
    </NodeViewWrapper>
  );
};
