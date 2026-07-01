import { useEffect, useMemo, useState } from "react";
import {
  Cloud,
  CloudOff,
  Database,
  Folder,
  GitCompare,
  HardDriveDownload,
  CheckCircle2,
  AlertCircle,
  Search,
} from "lucide-react";

import { HighTexDB } from "../editor/storage/hightex-db";
import { useUser } from "../hooks/use-user";
import { useAuthModal } from "../context/auth-modal-context";
import { useOnline } from "../hooks/use-online";
import { ParsedItalic } from "../utils/parse-italic";
import { formatDistanceToNow } from "date-fns";
import { ShouldNotified } from "@/exception/interfaces/should-notified";
import { importHighTexPackage } from "@/utils/import-hightex";
import { toast } from "sonner";
import { truncate } from "@/utils/truncate";
import { Link } from "react-router-dom";

export const RemoteDocuments = () => {
  const { user } = useUser();
  const { openLogin } = useAuthModal();
  const online = useOnline();

  const [loading, setLoading] = useState(true);
  const [cloudDoc, setCloudDoc] = useState<HighTexDocument | null>(null);
  const [localDoc, setLocalDoc] = useState<HighTexDocument | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const document = localDoc || cloudDoc;

  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    if (!user) return;

    let alive = true;
    (async () => {
      try {
        window.hightex.categories().then(setCategories)
        const res = await window.hightex.document();

        if (!alive) return;

        const remote = res?.document || res;
        setCloudDoc(remote);

        const db = HighTexDB.getInstance();
        if (remote?.id) {
          const local = await db.documents.get(remote.id);
          if (local) setLocalDoc(local);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [user]);

  if (!user) {
    return (
      <div className="w-full flex justify-center items-center h-full">
        <div className="flex-1 p-6 max-w-xl mx-auto overflow-auto relative w-full space-y-6">
          <div className="rounded-3xl bg-neutral-50 dark:bg-neutral-900 p-6 border border-neutral-100 dark:border-neutral-800 shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-white dark:bg-neutral-800 flex items-center justify-center mx-auto mb-4 shadow-sm">
              <Cloud
                size={20}
                className="text-neutral-500 dark:text-neutral-300"
              />
            </div>

            <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 text-center">
              Login Required
            </div>

            <div className="text-xs text-neutral-400 dark:text-neutral-500 text-center mt-1">
              Connect your cloud workspace to access remote documents
            </div>

            {!online && (
              <div className="mt-3 text-[11px] text-red-500 text-center">
                You are offline
              </div>
            )}

            <button
              onClick={openLogin}
              disabled={!online}
              className="mt-6 w-full py-2 rounded-xl bg-black dark:bg-white text-white dark:text-black text-xs hover:bg-neutral-800 dark:hover:bg-neutral-200 disabled:opacity-50"
            >
              Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-3xl bg-neutral-50 dark:bg-neutral-900 p-6 border border-neutral-100 dark:border-neutral-800 shadow-sm">
        <div className="text-sm text-neutral-400 dark:text-neutral-500 animate-pulse">
          Loading remote workspace...
        </div>
      </div>
    );
  }

  return (
    <>
      <div>
        <h1 className="text-xl font-semibold text-foreground">
          Remote Documents
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Sync your cloud workspace and manage remote document state.
        </p>
      </div>

      <Stats online={online} document={document} />

      {!document ? (
        <Empty />
      ) : (
        <>
          <div className="mb-5 flex flex-col space-y-2">
            <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
              <ParsedItalic text={document.title || "Untitled"} />
            </div>

            <div className="flex items-center gap-2 ">
              <button
                onClick={() => {
                  throw new ShouldNotified({ message: "Unimplemented", description: "This feature is currently available, planning for next updates" })
                }}
                className="px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition text-xs flex items-center gap-2">
                <GitCompare size={14} />
                Override Local
              </button>

              <button
                onClick={() => {
                  const id = toast.loading("Pulling document...")
                  window.ipcRenderer.invoke("hightex:document:pull", localDoc?.updatedAt?.toISOString()).then(r => {
                    if ("updated" in r) {
                      throw new ShouldNotified({ message: "Pull canceled", description: "Document already up to date" })
                    }
                    const file = new File([new Uint8Array(r as ArrayBuffer)], "pull.hightex")
                    return importHighTexPackage(file)
                  }).then((doc) => {
                    toast.success(`document ${truncate(doc.title.replace("_", ""), 13)} updated`, {
                      id
                    })
                  }).catch(_e => {
                    toast.error("pull failed", { id })
                  })

                }}
                className="px-3 py-2 rounded-xl bg-black dark:bg-white text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200 transition text-xs flex items-center gap-2">
                <HardDriveDownload size={14} />
                Pull Latest
              </button>
            </div>
          </div>

          <div className="rounded-2xl bg-neutral-50 dark:bg-neutral-900 p-5 space-y-5 border border-neutral-100 dark:border-neutral-800">
            {localDoc && cloudDoc && (
              <SyncBanner localDoc={localDoc} cloudDoc={cloudDoc} />
            )}

            <InfoRow label="Title" value={document.title} />
            {/* @ts-ignore */}
            <InfoRow label="English Title" value={document.en_title} />
            <InfoRow label="Category" value={categories.find(c => String(c.id) == document.category)?.name} />

            <KeywordSection keys={document.keywords} />
          </div>
        </>
      )
      }

      {
        pickerOpen && (
          <LocalDocumentPicker
            cloudDoc={cloudDoc}
            onClose={() => setPickerOpen(false)}
            onSelect={(doc: any) => {
              setLocalDoc(doc);
              setPickerOpen(false);
            }}
          />
        )
      }
    </>
  );
};
const Stats = ({ online, document }: any) => {
  return (
    <div className="grid grid-cols-3 gap-3 h-20 mb-6">
      <Stat
        icon={online ? <Cloud size={14} /> : <CloudOff size={14} />}
        label="Connection"
        value={online ? "Connected" : "Offline"}
      />

      <Stat
        icon={<Database size={14} />}
        label="Workspace"
        value="Remote Sync"
      />

      <Stat
        icon={<Folder size={14} />}
        label="Document"
        value={document?.id?.slice(0, 6) || "-"}
      />
    </div>
  );
};

const Stat = ({ icon, label, value }: any) => {
  return (
    <div className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 rounded-xl p-3">
      <div className="flex items-center gap-1 text-[11px] text-neutral-400 dark:text-neutral-500">
        {icon}
        {label}
      </div>

      <div className="text-sm font-medium mt-1 text-neutral-900 dark:text-neutral-100">
        {value}
      </div>
    </div>
  );
};

const SyncBanner = ({ localDoc, cloudDoc }: { cloudDoc?: HighTexDocument, localDoc?: HighTexDocument }) => {
  const sameId = localDoc?.id === cloudDoc?.id;

  if (sameId) {
    return (
      <div className="rounded-xl border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950 p-3 flex items-start gap-3">
        <CheckCircle2 size={16} className="text-green-500 mt-0.5" />

        <div>
          <div className="text-xs font-medium text-green-700 dark:text-green-400">
            You have this document locally
          </div>

          <div className="text-xs text-green-600 dark:text-green-500 mt-1">
            <span>Document </span> `<ParsedItalic text={cloudDoc!.title} />` exists locally, you can edit it <Link className="font-semibold underline" to={`/document/${cloudDoc!.id}/1`}>here</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950 p-3 flex items-start gap-3">
      <AlertCircle size={16} className="text-amber-500 mt-0.5" />

      <div>
        <div className="text-xs font-medium text-amber-700 dark:text-amber-400">
          Different Local Document
        </div>

        <div className="text-xs text-amber-600 dark:text-amber-500 mt-1">
          Overriding local document will replace your current local metadata.
        </div>
      </div>
    </div>
  );
};

const InfoRow = ({ label, value }: any) => (
  <div className="flex items-start justify-between gap-5">
    <div className="w-32 shrink-0 text-xs uppercase text-neutral-400 dark:text-neutral-500">
      {label}
    </div>

    <div className="flex-1 text-right text-sm text-neutral-800 dark:text-neutral-200">
      {value || "-"}
    </div>
  </div>
);

const KeywordSection = ({ keys }: { keys: Keywords | string }) => {
  const parsed = useMemo(() => {
    if (typeof keys == 'object') return keys
    try {
      return JSON.parse(keys)

    } catch (error) {

      return {
        indonesian: [],
        english: []
      }
    }

  }, [keys])

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-5">
        <div className="w-32 shrink-0 text-xs uppercase text-neutral-400 dark:text-neutral-500">
          Keywords
        </div>

        <div className="flex-1 space-y-3">
          <div>
            <div className="text-[11px] text-neutral-400 dark:text-neutral-500 mb-1">
              Indonesian
            </div>

            <div className="flex flex-wrap justify-end gap-1.5">
              {parsed.indonesian?.length ? (
                parsed.indonesian.map((k: string, i: number) => (
                  <div
                    key={i}
                    className="px-2 py-1 rounded-lg bg-white dark:bg-neutral-800 text-xs text-neutral-700 dark:text-neutral-200"
                  >
                    <ParsedItalic text={k} />
                  </div>
                ))
              ) : (
                <div className="text-xs text-neutral-300 dark:text-neutral-600">
                  no keywords
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="text-[11px] text-neutral-400 dark:text-neutral-500 mb-1">
              English
            </div>

            <div className="flex flex-wrap justify-end gap-1.5">
              {parsed.english?.length ? (
                parsed.english.map((k: string, i: number) => (
                  <div
                    key={i}
                    className="px-2 py-1 rounded-lg bg-white dark:bg-neutral-800 text-xs italic text-neutral-700 dark:text-neutral-200"
                  >
                    {k}
                  </div>
                ))
              ) : (
                <div className="text-xs text-neutral-300 dark:text-neutral-600">
                  no keywords
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Empty = () => (
  <div className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 rounded-2xl p-10 text-center">
    <div className="w-14 h-14 rounded-2xl bg-white dark:bg-neutral-800 shadow-sm flex items-center justify-center mx-auto mb-4">
      <CloudOff size={20} className="text-neutral-400 dark:text-neutral-500" />
    </div>

    <div className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
      No Remote Document
    </div>

    <div className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
      Your cloud workspace does not contain any synced document yet.
    </div>
  </div>
);
const LocalDocumentPicker = ({ onClose, onSelect, cloudDoc }: any) => {
  const [docs, setDocs] = useState<HighTexDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let alive = true;

    (async () => {
      const db = HighTexDB.getInstance();

      const result = await db.documents.toArray();

      const categories = await window.hightex.categories();

      const docs = await Promise.all(
        result.map(async (r) => {
          const category = categories.find(
            (s) => s.id.toString() === r.category,
          );

          return {
            ...r,
            category: category?.name || "-",
          };
        }),
      );

      if (!alive) return;

      setDocs(docs);
      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, []);

  const filtered = docs.filter((d) => {
    return d.title?.toLowerCase()?.includes(search.toLowerCase());
  });

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="w-175 bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-neutral-100">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Override Local Document</div>

              <div className="text-xs text-neutral-400 mt-1">
                Select a local document to replace with cloud version
              </div>
            </div>

            <button
              onClick={onClose}
              className="text-xs text-neutral-400 hover:text-neutral-700"
            >
              Close
            </button>
          </div>

          <div className="mt-4 relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
            />

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search local documents..."
              className="w-full bg-neutral-50 rounded-xl pl-9 pr-3 py-2 text-sm outline-none"
            />
          </div>
        </div>

        <div className="max-h-105 overflow-y-auto p-2">
          {loading && (
            <div className="p-5 text-xs text-neutral-400">
              Loading documents...
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="p-5 text-xs text-neutral-400">
              No local documents found
            </div>
          )}

          {filtered.map((doc) => {
            const sameId = cloudDoc?.id === doc.id;

            return (
              <button
                key={doc.id}
                onClick={() => onSelect(doc)}
                className="w-full group flex items-center justify-between px-4 py-3 rounded-2xl hover:bg-neutral-50 transition text-left"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-sm  truncate">{doc.title}</div>

                    {sameId && (
                      <div className="px-1.5 py-0.5 rounded-md bg-green-100 text-[10px] text-green-700">
                        MATCH
                      </div>
                    )}
                  </div>

                  <div className="mt-1 flex items-center gap-2 text-xs text-neutral-400">
                    <span>{doc.category || "-"}</span>

                    <span>•</span>

                    <span>{doc.id.slice(0, 6)}</span>
                  </div>
                </div>

                <div className="text-[11px] text-neutral-300 group-hover:text-neutral-500 transition">
                  {doc.updatedAt
                    ? formatDistanceToNow(new Date(doc.updatedAt), {
                      addSuffix: true,
                    })
                    : "No activity"}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
