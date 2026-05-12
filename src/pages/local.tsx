import { useEffect, useState } from "react";
import { HighTexDB } from "../editor/storage/hightex-db";
import {
  Eye,
  Trash,
  Folder,
  Database,
  CloudOff,
  FilePlus2,
  GitMerge,
  ChevronDown,
  File,
  Cloud,
  Plus,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useUser } from "../hooks/use-user";
import { useAuthModal } from "../context/auth-modal-context";
import { Dropdown, DropdownItem } from "../components/dropdown";
import { EventBus } from "../event/event-bus";

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
        leader: "",
        member1: "",
        member2: "",
      },
    };

    setDocuments((prev) => [doc, ...prev]);
    await db.documents.put(doc);
  };

  const renameDocument = async (id: string, title: string) => {
    if (!title.trim()) return;

    setDocuments((prev) =>
      prev.map((d) => (d.id === id ? { ...d, title } : d)),
    );

    await db.documents.update(id, { title });
    EventBus.emit("document:updated", { fromRenderer: true });
  };

  const deleteDocument = async (id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));

    await db.documents.delete(id);
  };

  if (loading) return <Loading />;

  return (
    <div className="flex-1 p-6 flex flex-col min-h-0">
      <>
        <Stats documents={documents} />

        <DocumentList
          documents={documents}
          onRename={renameDocument}
          onDelete={deleteDocument}
          onCreate={createDocument}
        />
      </>
    </div>
  );
};

const Stats = ({ documents }: { documents: HighTexDocument[] }) => {
  return (
    <div className="grid grid-cols-3 gap-3 h-20 mb-6">
      <Stat
        icon={<Database size={14} />}
        label="Documents"
        value={documents.length}
      />

      <Stat icon={<CloudOff size={14} />} label="Mode" value="Local First" />

      <Stat icon={<Folder size={14} />} label="Engine" value="HighTex v1" />
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

const DocumentList = ({ documents, onRename, onDelete, onCreate }: any) => {
  return (
    <div className="flex flex-col h-full min-h-0 rounded-xl">
      <div className="flex h-16 items-start justify-between px-4 py-4 ">
        <div>
          <div className="text-sm font-medium text-gray-900">
            Your Documents
          </div>

          <div className="text-xs text-gray-400 mt-0.5">
            Local workspace stored in your device
          </div>
        </div>
        <div className="flex items-center  text-xs  rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition">
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
              <button className="flex items-center justify-center px-2 py-1.5 rounded-lg hover:bg-black/10 transition">
                <ChevronDown size={14} />
              </button>
            }
          >
            <div className="p-1 text-xs">
              <DropdownItem>
                <div className="flex items-center gap-2 px-1 py-1 rounded-md hover:bg-slate-100 transition">
                  <Plus size={14} className="text-slate-600" />
                  <span className="font-light text-slate-700">
                    Create Empty
                  </span>
                </div>
              </DropdownItem>

              <DropdownItem>
                <label
                  htmlFor="hightex:file"
                  className="flex items-center gap-2 px-1 py-1 rounded-md hover:bg-slate-100 transition cursor-pointer"
                >
                  <File size={14} className="text-slate-600" />
                  <span className="font-light text-slate-700">
                    Import from file
                  </span>
                </label>

                <input
                  onChange={(e) => console.log(e.target.files)}
                  type="file"
                  id="hightex:file"
                  className="hidden"
                  accept=".hightex"
                />
              </DropdownItem>

              <div className="my-1 h-px bg-slate-200" />
              <DropdownItem>
                <div className="flex items-center gap-2 px-1 py-1 rounded-md hover:bg-slate-100 transition">
                  <Cloud size={14} className="text-slate-600" />
                  <span className="font-light text-slate-700">
                    Import from Cloud
                  </span>
                </div>
              </DropdownItem>
            </div>
          </Dropdown>
        </div>
      </div>

      <div className="flex-1 bg-gray-50 overflow-y-auto rounded-2xl min-h-0">
        {documents.length === 0 ? (
          <div className="p-6 text-xs text-gray-400">
            No documents yet. Create your first document to start writing.
          </div>
        ) : (
          documents.map((doc: any) => (
            <Row
              key={doc.id}
              doc={doc}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </div>
  );
};

const Row = ({ doc, onRename, onDelete }: any) => {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(doc.title);

  const [category, setCategory] = useState("-");
  const navigate = useNavigate();
  const { user } = useUser();
  const { openLogin } = useAuthModal();
  useEffect(() => {
    (async () => {
      const categories = await window.hightex.categories();

      const cat = categories.find((c) => {
        return doc.category == c.id;
      });
      if (cat) {
        setCategory(cat.name);
      }
    })();
  }, []);

  return (
    <div className="group flex items-center  justify-between px-4 py-3 hover:bg-gray-100">
      <div className="flex-1">
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
              if (e.key === "Escape") {
                setValue(doc.title);
                setEditing(false);
              }
            }}
            className="text-sm font-medium outline-none bg-transparent w-full"
          />
        ) : (
          <div
            onDoubleClick={() => setEditing(true)}
            className="text-sm font-medium"
          >
            {doc.title}
          </div>
        )}

        <div className="text-xs text-gray-400">{category || "-"}</div>
      </div>

      <div className="flex items-center gap-2">
        <button
          className="p-1 rounded-md ov hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition"
          onClick={() => {
            if (!user) {
              openLogin();
              return;
            }
            alert("merge");
          }}
        >
          <GitMerge size={14} className="text-green-500" />
        </button>
        <button
          className="p-1 rounded-md hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition"
          onClick={() => {
            navigate(`/document/${doc.id}`);
          }}
        >
          <Eye size={14} className="text-gray-500" />
        </button>

        <button
          onClick={() => onDelete(doc.id)}
          className="p-1 rounded-md hover:bg-red-50 opacity-0 group-hover:opacity-100 transition"
        >
          <Trash size={14} className="text-gray-400 hover:text-red-500" />
        </button>

        <div className="text-[11px] text-gray-300 w-10 text-right tabular-nums">
          {doc.id.slice(0, 6)}
        </div>
      </div>
    </div>
  );
};

const Loading = () => (
  <div className="h-screen flex items-center justify-center text-sm text-gray-400">
    Loading HighTex...
  </div>
);
