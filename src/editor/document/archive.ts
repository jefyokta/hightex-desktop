import type { Editor } from "@tiptap/core";
import type { Chapter } from "../chapter";
import { getEditorChapter } from "../event";
import { Manager } from "../manager";
import { Storage } from "../storage";
import { documentDrafts } from "../document-drafts";
import { Exporter } from "@/utils/htx/exporter";
import { t } from "@/utils/lang";

/** Both explicit Save and close-save capture the same committed content and settings draft. */
export async function flushDocumentChanges(documentId: string, editor: Editor | null, chapter: Chapter | null) {
  const bound = editor ? getEditorChapter(editor) : undefined;
  if (bound?.getDocumentId() === documentId && editor?.isEditable)
    await Manager.emit("update", { editor });
  else if (!chapter?.frozen || chapter.getDocumentId() !== documentId)
    throw Error(t("editor.save.not_ready"));
  await Storage.instance.waitForDocument(documentId);
}

export async function captureDocumentArchive(documentId: string, editor: Editor | null, chapter: Chapter | null) {
  await flushDocumentChanges(documentId, editor, chapter);
  const draft = documentDrafts.get(documentId);
  const archive = await new Exporter(documentId).buildExport(undefined, draft?.document);
  return {
    ...archive, draft,
    fileName: `${archive.document.title.replace(/[^a-zA-Z0-9-_. ]/g, "-")}.hightex`,
  };
}

export type CapturedDocumentArchive = Awaited<ReturnType<typeof captureDocumentArchive>>;
