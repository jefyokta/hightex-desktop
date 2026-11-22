import { useEffect, useMemo, useState } from "react";
import { liveQuery } from "dexie";
import { useParams } from "react-router-dom";
import { HighTexDB } from "@/editor/storage/hightex-db";
import { documentReferenceUsage, type UsageChapter } from "@/editor/document/reference-usage";
import { useCurrentEditor } from "@/hooks/use-editor";
import { useScannerNavigation } from "@/hooks/use-scanner-navigation";
import { getEditorChapter } from "@/editor/event";
import { ReferenceUsagePanel } from "../reference-usage-panel";
import { TabHeader } from "./components/tab-header";
import { t } from "@/utils/lang";

export function ReferenceUsage() {
  const { id } = useParams();
  const { editor } = useCurrentEditor();
  const navigate = useScannerNavigation();
  const [stored, setStored] = useState<{ id: string; chapters: UsageChapter[]; references: Record<string, string> }>();
  const [buffer, setBuffer] = useState<UsageChapter>();
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!id) return;
    setError(false);
    const db = HighTexDB.getInstance();
    const subscription = liveQuery(async () => ({
      id,
      chapters: await db.chapters.where("id").startsWith(`${id}.`).toArray(),
      references: Object.fromEntries((await db.cite.toArray()).map(record => [record.key, record.bib])),
    })).subscribe({ next: setStored, error: () => setError(true) });
    return () => subscription.unsubscribe();
  }, [id]);
  useEffect(() => {
    const update = () => {
      const chapter = editor && !editor.isDestroyed ? getEditorChapter(editor) : undefined;
      setBuffer(chapter && editor?.isEditable ? { id: chapter.getId(), content: editor.getJSON().content ?? [] } : undefined);
    };
    update();
    editor?.on("update", update);
    return () => { editor?.off("update", update); };
  }, [editor]);
  const entries = useMemo(() => {
    if (!stored || stored.id !== id) return [];
    const chapters = stored.chapters.filter(chapter => chapter.id !== buffer?.id);
    if (buffer?.id.startsWith(`${id}.`)) chapters.push(buffer);
    return documentReferenceUsage(chapters, stored.references);
  }, [stored, buffer, id]);

  return <div className="flex h-full flex-col">
    <TabHeader title={t("usage.title")} desc={t("usage.description")} />
    <div className="min-h-0 overflow-auto p-3">
      {error ? <p role="alert">{t("usage.failed")}</p> : <ReferenceUsagePanel entries={entries} onNavigate={location => void navigate({
        pluginId: "reference-usage", code: "usage", message: location.excerpt, severity: "warning",
        chapterId: location.chapterId, path: location.path, nodeId: location.nodeId,
      })} />}
    </div>
  </div>;
}
