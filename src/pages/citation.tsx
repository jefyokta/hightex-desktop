import { useEffect, useMemo, useState } from "react";
import { HighTexDB } from "../editor/storage/hightex-db";
import { CiteUtils } from "bibtex.js";

import { Search, Trash, Copy, Quote, Plus, BookText } from "lucide-react";

export const Citation = () => {
  const [citations, setCitations] = useState<CiteUtils[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const db = HighTexDB.getInstance();

  useEffect(() => {
    let alive = true;

    (async () => {
      const rows = await db.cite.toArray();

      console.log(rows);
      const mapped = rows.map((c) => {
        return new CiteUtils(c.bib).setId(c.key);
      });

      if (alive) {
        setCitations(mapped);
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return citations;

    return citations.filter((c) => {
      return (
        c.getId().toLowerCase().includes(query.toLowerCase()) ||
        JSON.stringify(c.getCite()).toLowerCase().includes(query.toLowerCase())
      );
    });
  }, [citations, query]);

  const deleteCitation = async (id: string) => {
    setCitations((prev) => {
      return prev.filter((c) => c.getId() !== id);
    });

    await db.cite.delete(id);
  };

  const copyCitation = async (text: string) => {
    await navigator.clipboard.writeText(text);
  };

  const addCitation = async () => {
    console.log("open add citation modal");
  };

  if (loading) {
    return <Loading />;
  }

  return (
    <div className="flex-1 p-6 flex flex-col min-h-0">
      <Stats total={citations.length} />

      <div className="flex flex-col h-full min-h-0 rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm font-medium text-gray-900">
              Citation Library
            </div>

            <div className="text-xs text-gray-400 mt-0.5">
              Manage your bibliography references
            </div>
          </div>

          <button
            onClick={addCitation}
            className="flex items-center gap-1.5 rounded-xl bg-gray-900 text-white px-3 py-2 text-xs hover:bg-gray-800 transition"
          >
            <Plus size={14} />
            Add Citation
          </button>
        </div>

        <div className="relative mb-4">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />

          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search citation..."
            className="w-full rounded-xl bg-gray-50 ps-9 pe-3 py-2 text-sm outline-none border border-transparent focus:border-gray-200"
          />
        </div>

        <div className="flex-1 bg-gray-50 overflow-y-auto rounded-2xl min-h-0">
          {filtered.length === 0 ? (
            <div className="p-6 text-xs text-gray-400">No citations yet.</div>
          ) : (
            filtered.map((cite, i) => (
              <Row
                key={i}
                cite={cite}
                onDelete={deleteCitation}
                onCopy={copyCitation}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

const Stats = ({ total }: { total: number }) => {
  return (
    <div className="grid grid-cols-3 gap-3 h-20 mb-6">
      <Stat icon={<Quote size={14} />} label="Citations" value={total} />

      <Stat icon={<BookText size={14} />} label="Format" value="BibTeX" />
    </div>
  );
};

const Stat = ({ icon, label, value }: any) => {
  return (
    <div className="bg-gray-50 rounded-xl p-3">
      <div className="flex items-center gap-1 text-[11px] text-gray-400">
        {icon}
        {label}
      </div>

      <div className="text-sm font-medium mt-1">{value}</div>
    </div>
  );
};

const Row = ({ cite, onDelete, onCopy }: any) => {
  return (
    <div className="group flex items-start justify-between gap-4 px-4 py-4 hover:bg-gray-100 border-b border-gray-100 transition">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Quote size={14} className="text-gray-400 shrink-0" />

          <div className="text-sm font-medium truncate">{cite.getId()}</div>
        </div>
        <div className="pl-5">
          <div className="mt-2 text-xs text-gray-500 ">{cite.getTitle()}</div>

          <pre className="mt-3 text-[11px] text-gray-400 whitespace-pre-wrap break-all overflow-x-auto">
            {cite.toCite()}
          </pre>
        </div>
      </div>

      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition">
        <button
          onClick={() => onCopy(cite.toCite())}
          className="p-2 rounded-lg hover:bg-white"
        >
          <Copy size={14} className="text-gray-500" />
        </button>

        <button
          onClick={() => onDelete(cite.getId())}
          className="p-2 rounded-lg hover:bg-red-50"
        >
          <Trash size={14} className="text-gray-400 hover:text-red-500" />
        </button>
      </div>
    </div>
  );
};

const Loading = () => (
  <div className="h-screen flex items-center justify-center text-sm text-gray-400">
    Loading citations...
  </div>
);
