import { useIPC } from "@/hooks/use-ipc";
import { useAppLanguage } from "@/hooks/use-app-language";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { FileText, RefreshCw } from "lucide-react";
import { HighTexDB } from "@/editor/storage/hightex-db";
import { Manager } from "@/editor/manager";
import { HighTexImporter } from "@/utils/import-v2";
import { toast } from "sonner";
import { Exporter } from "@/utils/htx/exporter";
import { DocumentList } from "@/components/local/document-list";
import type { DocumentMetadata } from "@/components/local/document-dialog";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { t } from "@/utils/lang";
import { normalizeAuthorProfile } from "@/utils/document-profile";
import { liveQuery } from "dexie";

export const Dashboard = () => {
  useAppLanguage();
  const [documents, setDocuments] = useState<HighTexDocument[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [categoryError, setCategoryError] = useState(false);
  const alive = useRef(true);
  const revision = useRef(0);
  const db = HighTexDB.getInstance();

  const load = useCallback(async () => {
    const request = ++revision.current;
    setLoading(true);
    setError(false);
    const [docs, types] = await Promise.allSettled([
      db.documents.toArray(),
      useIPC("hightex").hightex.categories(),
    ]);
    if (!alive.current || request !== revision.current) return;
    if (docs.status === "fulfilled") setDocuments(docs.value);
    else setError(true);
    setCategoryError(types.status === "rejected");
    if (types.status === "fulfilled") setCategories(types.value);
    setLoading(false);
  }, [db]);

  useEffect(() => {
    alive.current = true;
    void load();
    const offCategories = useIPC("hightex").hightex.onCategoriesChanged?.(
      () => void load(),
    );
    // Imports and recovery copies are committed by another editor window.
    const documents = liveQuery(() => db.documents.toArray()).subscribe({
      next: (documents) => {
        setDocuments(documents);
        setError(false);
      },
      error: () => setError(true),
    });
    return () => {
      alive.current = false;
      offCategories?.();
      documents.unsubscribe();
    };
  }, [load]);

  const createDocument = async (metadata: DocumentMetadata) => {
    const category = categories.find(
      (item) => String(item.id) === metadata.category,
    );
    if (!category) throw Error("Unavailable category");
    const [profile, picture] = await Promise.all([
      useIPC("profile").profile.get(),
      useIPC("profile").profile.picture(),
    ]);
    const doc: HighTexDocument = {
      ...metadata,
      id: crypto.randomUUID(),
      parentId: null,
      updatedAt: new Date(),
      profile: {
        ...normalizeAuthorProfile(profile)!,
        ...(category.variant === "intern"
          ? {
              advisorName: "",
              advisorNip: "",
              secondAdvisor: undefined,
              committee: {},
            }
          : {}),
        picture: picture
          ? new Blob([new Uint8Array(picture)], { type: "image/webp" })
          : undefined,
      },
      config: {
        consentDate: new Date(),
        validityDate: new Date(),
        statementDate: new Date(),
      },
      authorProfileMode: "workspace",
    };
    await db.documents.put(doc);
    Manager.app.dispatch("document:updated", { document: doc });
    toast.success(t("dashboard.created"));
    try {
      await useIPC("editor").editor.open(doc.id);
    } catch {
      toast.error(t("dashboard.open_failed"));
    }
  };

  const importFromFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const toastId = toast.loading(t("common.importing"));
    try {
      const importer = await HighTexImporter.create(
        file,
        await useIPC("file").file.getPath(file),
      );
      await importer.open();
    } finally {
      toast.dismiss(toastId);
      event.target.value = "";
    }
  };

  const saveDocument = async (id: string, metadata: DocumentMetadata) => {
    const current = await db.documents.get(id);
    if (!current) throw Error("Document unavailable");
    await db.updateDocument({ ...current, ...metadata });
    toast.success(t("dashboard.saved"));
  };
  const deleteDocument = async (id: string) => {
    const ids = [id];
    const collect = async (parentId: string) => {
      const children = await db.documents
        .where("parentId")
        .equals(parentId)
        .toArray();
      for (const child of children) {
        await collect(child.id);
        ids.push(child.id);
      }
    };
    await collect(id);
    await Manager.deleteDocument(id);
    const remaining = await db.documents.bulkGet(ids);
    const deletedIds = ids.filter((_, index) => !remaining[index]);
    if (deletedIds.length) {
      Manager.app.dispatch("documents:deleted", { documentIds: deletedIds });
      toast.success(t("dashboard.deleted"));
    }
  };
  const deleteMany = async (ids: string[]) => {
    await Manager.deleteDocuments(...ids);
    const remaining = await db.documents.bulkGet(ids);
    return ids.filter((_, index) => !remaining[index]);
  };
  const exportDocument = async (id: string) => {
    const toastId = toast.loading(t("dashboard.exporting"));
    try {
      const result = await new Exporter(id, {
        format: "json",
        ext: "hightex",
      }).export();
      if (result.canceled) {
        toast.dismiss(toastId);
        return false;
      }
      toast.success(t("common.export_success"), { id: toastId });
      return true;
    } catch (error) {
      toast.dismiss(toastId);
      throw error;
    }
  };

  if (loading || error)
    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow={t("workspace.tagline")}
          title={t("dashboard.your_documents")}
          description={t("dashboard.documents_subtitle")}
        />
        {loading ? (
          <div
            role="status"
            aria-label={t("dashboard.loading")}
            className="space-y-3 rounded-2xl border p-5"
          >
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                className="flex items-center gap-4 rounded-lg p-3 motion-safe:animate-pulse"
              >
                <div className="size-10 rounded-xl bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-3/5 rounded bg-muted" />
                  <div className="h-2 w-1/4 rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div
            role="alert"
            className="flex min-h-72 flex-col items-center justify-center rounded-2xl border p-8 text-center"
          >
            <FileText className="mb-4 size-7 text-muted-foreground" />
            <h2 className="font-semibold">{t("dashboard.load_failed")}</h2>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              {t("dashboard.load_failed_description")}
            </p>
            <Button
              className="mt-5"
              variant="outline"
              onClick={() => void load()}
            >
              <RefreshCw />
              {t("dashboard.retry")}
            </Button>
          </div>
        )}
      </div>
    );

  return (
    <>
      {categoryError && (
        <div
          role="alert"
          className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs"
        >
          <p>{t("dashboard.categories_failed")}</p>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            {t("dashboard.retry")}
          </Button>
        </div>
      )}
      <DocumentList
        documents={documents}
        categories={categories}
        onSave={saveDocument}
        onDelete={deleteDocument}
        onDeleteMany={deleteMany}
        onCreate={createDocument}
        onImport={importFromFile}
        onExport={exportDocument}
      />
    </>
  );
};
