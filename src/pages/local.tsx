import { useEffect, useState, ChangeEvent } from "react";
import { HighTexDB } from "../editor/storage/hightex-db";
import { Manager } from "@/editor/manager";
import { importHighTexPackage } from "@/utils/import-hightex";
import { importHighTexV2Package } from "@/utils/import-v2";
import { toast } from "sonner";
import { truncate } from "@/utils/truncate";
import { Exporter } from "@/utils/htx/exporter";
import { DocumentList } from "@/components/local/document-list";
import { CategoryEmpty } from "@/exception/categories-empty";

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

    if (!defaultCategory) {
      throw new CategoryEmpty
    }

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
      const name = file.name.toLowerCase();
      const importedDocument =
        name.endsWith(".hightex") || name.endsWith(".hightex.zip")
          ? await importHighTexPackage(file)
          : await importHighTexV2Package(file);

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

  const exportDocument = async (id: string, format: ContentFormat = "json") => {
    const toastId = toast.loading(`Exporting HighTex  package...`);
    const exporter = new Exporter(id, {
      format,
      ext: "hightex",
    });

    try {
      const result = await exporter.export();
      if (result.canceled) {
        toast.dismiss(toastId);
        return;
      }
      toast.success(`Export successful`, { id: toastId });
    } catch (err) {
      console.error("Export failed", err);
      toast.error("Export failed", { id: toastId });
    }
  };

  if (loading) return <Loading />;

  return (
    <DocumentList
      documents={documents}
      onRename={renameDocument}
      onDelete={deleteDocument}
      onCreate={createDocument}
      onImport={importFromFile}
      onExport={exportDocument}
    />
  );
};

const Loading = () => (
  <div className="flex items-center justify-center text-sm text-neutral-400">
    Loading HighTex...
  </div>
);
