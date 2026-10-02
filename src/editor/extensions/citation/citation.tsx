import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { Plus, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { HighTexDB } from "@/editor/storage/hightex-db";
import { formatInTextCitation } from "@/utils/citation";
import { CiteUtils } from "bibtex.js";

interface CiteRecord {
  key: string;
  bib: string;
}

type CitationItemProps = {
  cite: CiteRecord;
  onRemove?: () => void;
  onAdd?: () => void;
  selected?: boolean;
};

const CitationItem = ({
  cite,
  onRemove,
  onAdd,
  selected = false,
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
          aria-label="Remove citation"
        >
          <X size={15} />
        </button>
      )}

      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          disabled={selected}
          className="
            shrink-0 rounded-md p-1
            text-neutral-400
            hover:bg-neutral-100 hover:text-neutral-700
            disabled:cursor-default disabled:opacity-40
            dark:hover:bg-neutral-800 dark:hover:text-neutral-200
          "
          aria-label="Add citation"
        >
          {selected ? (
            <span className="px-1 text-xs">Added</span>
          ) : (
            <Plus size={16} />
          )}
        </button>
      )}
    </div>
  );
};

export const Citation: React.FC<NodeViewProps> = ({
  node,
  updateAttributes,
}) => {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"view" | "add">("view");

  const [cites, setCites] = useState<CiteRecord[]>([]);
  const [bibliography, setBibliography] = useState<CiteRecord[]>([]);

  const [fetchedCite, setFetchedCite] = useState("(Loading)");
  const [search, setSearch] = useState("");

  const citeIds = useMemo(
    () => node.attrs.cite?.split("|").filter(Boolean) ?? [],
    [node.attrs.cite],
  );

  useEffect(() => {
    let mounted = true;

    const loadCites = async () => {
      const db = HighTexDB.getInstance();

      const result = (
        await Promise.all(citeIds.map((id: string) => db.cite.get(id)))
      ).filter((cite): cite is CiteRecord => cite !== undefined);

      if (mounted) {
        setCites(result);
      }
    };

    loadCites();

    return () => {
      mounted = false;
    };
  }, [citeIds]);

  useEffect(() => {
    if (!open || mode !== "add") {
      return;
    }

    let mounted = true;

    const loadBibliography = async () => {
      const result = await HighTexDB.getInstance().cite.toArray();

      if (mounted) {
        setBibliography(result);
      }
    };

    loadBibliography();

    return () => {
      mounted = false;
    };
  }, [open, mode]);

  useEffect(() => {
    const { inText } = formatInTextCitation(cites, node.attrs.citeA);

    setFetchedCite(inText);
  }, [cites, node.attrs.citeA]);

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

  const filteredBibliography = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return bibliography;
    }

    return bibliography.filter((cite) => {
      const utils = new CiteUtils(cite.bib).setId(cite.key);

      return [utils.toCite(), utils.toCiteA(), utils.getTitle(), cite.key]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [bibliography, search]);

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
          <cite
            className="
              cursor-pointer rounded px-0.5
              text-neutral-700
              hover:bg-yellow-200
              dark:text-neutral-300
              dark:hover:bg-yellow-900/40
            "
          >
            {fetchedCite}
          </cite>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          className="
            w-100 overflow-hidden rounded-xl border
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
                  <h2 className="text-sm font-semibold">Add citation</h2>

                  <p className="truncate text-xs text-neutral-500">
                    Select a reference from your bibliography
                  </p>
                </div>
              </div>

              <div className="p-3">
                <div
                  className="
                    flex items-center gap-2 rounded-lg border
                    border-neutral-200 px-3
                    dark:border-neutral-700
                  "
                >
                  <Search size={15} className="shrink-0 text-neutral-400" />

                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search bibliography..."
                    className="
                      h-9 w-full bg-transparent text-sm outline-none
                      placeholder:text-neutral-400
                    "
                    autoFocus
                  />
                </div>
              </div>

              <div className="max-h-72 overflow-y-auto px-3 pb-3">
                {filteredBibliography.length > 0 ? (
                  <div className="divide-y rounded-lg border border-neutral-200 dark:divide-neutral-700 dark:border-neutral-700">
                    {filteredBibliography.map((cite) => (
                      <CitationItem
                        key={cite.key}
                        cite={cite}
                        selected={citeIds.includes(cite.key)}
                        onAdd={() => addCitation(cite.key)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-sm text-neutral-500">
                    No bibliography found.
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="border-b px-4 py-3">
                <h2 className="text-sm font-semibold">Citation</h2>

                <p className="text-xs text-neutral-500">
                  Manage references in this citation
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
                    No citations added.
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
                  Add citation
                </button>
              </div>

              <div className="border-t px-3 py-3">
                <div className="mb-2 px-1 text-xs font-medium text-neutral-500">
                  Format
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
                    <TabsTrigger value="standard">Standard</TabsTrigger>

                    <TabsTrigger value="author">Author</TabsTrigger>
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
