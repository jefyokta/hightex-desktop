import { useEffect, useState, ChangeEvent } from "react";
import { HighTexDB } from "../editor/storage/hightex-db";
import { Manager } from "@/editor/manager";
import { HighTexImporter } from "@/utils/import-v2";
import { toast } from "sonner";
import { truncate } from "@/utils/truncate";
import { Exporter } from "@/utils/htx/exporter";
import { DocumentList } from "@/components/local/document-list";
import { CategoryEmpty } from "@/exception/categories-empty";
import { t } from "@/utils/lang";
import { resolveImportMode } from "@/utils/import-conflict";
import { normalizeAuthorProfile } from "@/utils/document-profile";

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
  }, [db.documents]);

  const createDocument = async () => {
    const categories = await window.hightex.categories();
    const defaultCategory = categories[0];

    if (!defaultCategory) {
      throw new CategoryEmpty();
    }

    const [profile, picture] = await Promise.all([
      window.profile.get(),
      window.profile.picture(),
    ]);

    const doc: HighTexDocument = {
      id: crypto.randomUUID(),
      title: t("common.untitled_document"),
      altTitle: "",
      category: defaultCategory.id.toString(),
      keywords: { indonesian: [], english: [] },
      profile: {
        ...normalizeAuthorProfile(profile)!,
        ...(defaultCategory.variant === "intern"
          ? {
              advisorName: "",
              advisorNip: "",
              secondAdvisor: undefined,
            }
          : {}),
        picture: picture
          ? new Blob([new Uint8Array(picture)], {
              type: "image/webp",
            })
          : undefined,
      },
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
    const id = toast.loading(t("common.importing"));
    try {
      const importer = await HighTexImporter.create(
        file,
        await window.file.getPath(file),
      );
      const mode = await resolveImportMode(importer);
      if (!mode) return;
      const importedDocument = await importer.import(mode);

      setDocuments((prev) => [
        importedDocument,
        ...prev.filter((doc) => doc.id !== importedDocument.id),
      ]);
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
    const tid = truncate(id, 5);

    if (await Manager.deleteDocument(id)) {
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      toast.success(`deleted ${tid}`);
    }
  };

  const exportDocument = async (id: string, format: ContentFormat = "json") => {
    const toastId = toast.loading(`${t("common.export")} HighTex...`);
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
      toast.success(t("common.export_success"), { id: toastId });
    } catch (err) {
      console.error("Export failed", err);
      toast.error(t("common.export_failed"), { id: toastId });
    }
  };

  useEffect(() => {
    return Manager.app.on("documents:deleted", ({ documentIds }) => {
      setDocuments((prev) => prev.filter((d) => !documentIds.includes(d.id)));
    });
  }, []);

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

const Loading = () => {
  return (
    <div className="flex items-center justify-center text-sm text-neutral-400">
      {t("dashboard.loading")}
    </div>
  );
};
