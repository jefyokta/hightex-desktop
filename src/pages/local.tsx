import { useEffect, useState, ChangeEvent } from "react";
import { HighTexDB } from "../editor/storage/hightex-db";
import {
  Eye,
  Trash,
  FilePlus2,
  GitMerge,
  ChevronDown,
  File,
  Cloud,
  Plus,
  HardDriveDownload,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useUser } from "../hooks/use-user";
import { useAuthModal } from "../context/auth-modal-context";
import { Dropdown, DropdownItem } from "../components/dropdown";
import { Manager } from "@/editor/manager";
import { importHighTexPackage } from "@/utils/import-hightex";
import { saveHighTexPackage } from "@/utils/export-hightex";
import { toast } from "sonner";
import { truncate } from "@/utils/truncate";

export const Dashboard = () => {
  const [documents, setDocuments] = useState<HighTexDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const db = HighTexDB.getInstance();

  useEffect(() => {
    let alive = true;

    const load = async () => {
      const docs = await db.documents.toArray();

      if (alive) {
        setDocuments(docs);
        setLoading(false);
      }
    };

    load();
    return () => {
      alive = false;
    };
  }, []);

  const createDocument = async () => {
    const categories = await window.hightex.categories();
    const defaultCategory = categories[0];

    const doc: HighTexDocument = {
      id: crypto.randomUUID(),
      title: "Untitled Document",
      altTitle: "",
      category: defaultCategory.id.toString(),
      keywords: { indonesian: [], english: [] },
      config: {
        consentDate: new Date(),
        validityDate: new Date(),
        statementDate: new Date(),
        leader: "Angraini, S.Kom., M.Eng., Ph.D",
        member_1: "Zarnelly, S.Kom., M.Sc",
        member_2: "Anofrizen, S.Kom., M.Kom",
      },
    };

    setDocuments((prev) => [doc, ...prev]);
    await db.documents.put(doc);
  };

  const importFromFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const id = toast.loading("Importing");
    try {
      const importedDocument = await importHighTexPackage(file);
      setDocuments((prev) => [importedDocument, ...prev]);
      toast.success(`${truncate(importedDocument.title)} added`);
    } finally {
      toast.dismiss(id);
      event.target.value = "";
    }
  };

  const renameDocument = async (id: string, title: string) => {
    if (!title.trim()) return;

    setDocuments((prev) =>
      prev.map((d) => (d.id === id ? { ...d, title } : d)),
    );
    const doc = await db.documents.get(id);
    if (!doc) return;
    await db.updateDocument({ ...doc, title });
  };

  const deleteDocument = async (id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    await Manager.deleteDocument(id);
  };

  const exportDocument = async (id: string, title: string) => {
    const fileName = `${truncate(title || id, 30)}.hightex`;
    const toastId = toast.loading("Exporting HighTex package...");

    try {
      const result = await saveHighTexPackage(id, fileName);
      if (result.canceled) {
        toast.dismiss(toastId);
        return;
      }

      toast.success("Export successful", { id: toastId });
    } catch (err) {
      console.error("Export failed", err);
      toast.error("Export failed", { id: toastId });
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="flex-1 p-6 max-w-3xl mx-auto overflow-auto relative w-full space-y-6">
      {/* <Stats documents={documents} /> */}

      <DocumentList
        documents={documents}
        onRename={renameDocument}
        onDelete={deleteDocument}
        onCreate={createDocument}
        onImport={importFromFile}
        onExport={exportDocument}
      />
    </div>
  );
};

const DocumentList = ({
  documents,
  onRename,
  onDelete,
  onCreate,
  onImport,
  onExport,
}: any) => {
  return (
    <div className="flex flex-col h-full min-h-0 rounded-xl">
      <div className="flex h-16 mb-4 items-start justify-between px-4 py-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Your Documents
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            Local workspace stored in your device
          </p>
        </div>

        <div className="relative flex items-center text-xs rounded-lg bg-neutral-900 dark:bg-neutral-800 text-white hover:bg-neutral-800 dark:hover:bg-neutral-700 transition">
          <button
            onClick={onCreate}
            className="flex items-center gap-1 ps-3 pe-1 py-1.5"
          >
            <FilePlus2 size={14} />
            New
          </button>

          <Dropdown
            align="right"
            width={"max-content"}
            trigger={
              <button className="flex items-center justify-center px-2 py-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition">
                <ChevronDown size={14} />
              </button>
            }
          >
            <div className="p-1 text-xs bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800">
              <DropdownItem onClick={onCreate}>
                <div className="flex items-center gap-2 px-1 py-1 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition">
                  <Plus
                    size={14}
                    className="text-neutral-600 dark:text-neutral-400"
                  />

                  <span className="font-light text-neutral-700 dark:text-neutral-200">
                    Create Empty
                  </span>
                </div>
              </DropdownItem>

              <DropdownItem>
                <label
                  htmlFor="hightex:file"
                  className="flex items-center gap-2 px-1 py-1 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
                >
                  <File
                    size={14}
                    className="text-neutral-600 dark:text-neutral-400"
                  />

                  <span className="font-light text-neutral-700 dark:text-neutral-200">
                    Import from file
                  </span>
                </label>

                <input
                  onChange={onImport}
                  type="file"
                  id="hightex:file"
                  className="hidden"
                  accept=".hightex"
                />
              </DropdownItem>

              <div className="my-1 h-px bg-neutral-200 dark:bg-neutral-800" />

              <DropdownItem>
                <div className="flex items-center gap-2 px-1 py-1 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition">
                  <Cloud
                    size={14}
                    className="text-neutral-600 dark:text-neutral-400"
                  />

                  <span className="font-light text-neutral-700 dark:text-neutral-200">
                    Import from Cloud
                  </span>
                </div>
              </DropdownItem>
            </div>
          </Dropdown>
        </div>
      </div>

      <div className="flex-1 bg-neutral-50 p-2 dark:bg-neutral-900/50 overflow-y-auto rounded-2xl min-h-0 border border-transparent dark:border-neutral-800">
        {documents.length === 0 ? (
          <div className="p-6 text-xs text-neutral-400 dark:text-neutral-500">
            No documents yet. Create your first document to start writing.
          </div>
        ) : (
          documents.map((doc: any) => (
            <Row
              key={doc.id}
              doc={doc}
              onRename={onRename}
              onDelete={onDelete}
              onExport={onExport}
            />
          ))
        )}
      </div>
    </div>
  );
};
const Row = ({ doc, onRename, onDelete, onExport }: any) => {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(doc.title);

  const [category, setCategory] = useState("-");
  const navigate = useNavigate();
  const { user } = useUser();
  const { openLogin } = useAuthModal();

  useEffect(() => {
    (async () => {
      const categories = await window.hightex.categories();

      const cat = categories.find((c) => doc.category == c.id);

      if (cat) setCategory(cat.name);
    })();
  }, []);

  const updatedAt = doc.updatedAt
    ? new Date(doc.updatedAt).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <div className="group flex items-center justify-between rounded-xl border border-transparent px-4 py-3 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900/60">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <File size={16} className="text-neutral-500 dark:text-neutral-400" />
        </div>

        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onBlur={() => {
                onRename(doc.id, value);
                setEditing(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onRename(doc.id, value);
                  setEditing(false);
                }
              }}
              className="w-full bg-transparent text-sm font-medium outline-none text-neutral-900 dark:text-neutral-100"
            />
          ) : (
            <div
              onDoubleClick={() => setEditing(true)}
              className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100 cursor-text"
            >
              {doc.title}
            </div>
          )}

          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
            <span className="rounded-md border border-neutral-200 dark:border-neutral-800 px-1.5 py-0.5 text-neutral-500 dark:text-neutral-400">
              {category || "-"}
            </span>

            {updatedAt && (
              <>
                <span className="text-neutral-300 dark:text-neutral-600">
                  •
                </span>

                <span className="text-neutral-400 dark:text-neutral-500">
                  Updated {updatedAt}
                </span>
              </>
            )}

            <span className="text-neutral-300 dark:text-neutral-600">•</span>

            <span className="tabular-nums text-neutral-400 dark:text-neutral-500">
              {doc.id.slice(0, 6)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 transition"
          onClick={() => {
            if (!user) return openLogin();

            alert("merge");
          }}
        >
          <GitMerge size={14} className="text-green-500" />
        </button>

        <button
          className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 transition"
          onClick={() => onExport?.(doc.id, doc.title)}
        >
          <HardDriveDownload
            size={14}
            className="text-neutral-500 dark:text-neutral-300"
          />
        </button>

        <button
          className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 transition"
          onClick={() => navigate(`/document/${doc.id}`)}
        >
          <Eye size={14} className="text-neutral-500 dark:text-neutral-300" />
        </button>

        <button
          onClick={() => onDelete(doc.id)}
          className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition"
        >
          <Trash size={14} className="text-neutral-400 hover:text-red-500" />
        </button>
      </div>
    </div>
  );
};
const Loading = () => (
  <div className="h-screen flex items-center justify-center text-sm text-neutral-400">
    Loading HighTex...
  </div>
);
