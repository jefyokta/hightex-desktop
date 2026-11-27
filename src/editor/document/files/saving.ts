import { useIPC } from "@/hooks/use-ipc";
import { Manager } from "../../manager";
import { documentDrafts } from "../../document-drafts";
import { observeDocumentSources } from "../../storage/document-source-observer";
import { documentFiles } from "./source";
import type { CapturedDocumentArchive } from "./archive";
import { toast } from "sonner";
import { t } from "@/utils/lang";
import type { DocumentSaveState, EditingChapter } from "./contracts";

/** The renderer session owns save state across chapters and both save entry points. */
export class DocumentSaving {
  private state: DocumentSaveState = { ready: false, missing: false, modified: true, saving: false };
  private listeners = new Set<() => void>();
  private documentId?: string;
  private controller?: AbortController;
  private stopEvents?: () => void;
  private generation = 0;
  private editingChapter?: EditingChapter;

  read = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  private update(patch: Partial<DocumentSaveState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach(listener => listener());
  }

  watchChapter(chapter: EditingChapter) {
    this.editingChapter = chapter;
    return () => {
      if (this.editingChapter === chapter) this.editingChapter = undefined;
    };
  }

  async start(documentId: string, bytes: Uint8Array) {
    this.stop();
    this.documentId = documentId;
    const status = await documentFiles.status(documentId, bytes);
    this.update({ ready: true, saving: false, error: undefined, externalChanged: false, ...status });
    this.controller = new AbortController();

    const observation = this.observeChanges(documentId, this.controller.signal);
    await observation.ready;
    await this.reconcile();
  }

  private observeChanges(documentId: string, signal: AbortSignal) {
    const observer = observeDocumentSources([documentId], () => {
      const wasClean = !this.state.modified;
      this.changed();
      // Reconcile the first notification after a clean save; editing never re-exports ZIPs.
      if (wasClean && !this.state.saving) void this.reconcile();
    }, signal, { ignoreFileMetadata: true });
    const offDocument = Manager.app.on("document:updated", ({ document }) => {
      if (document.id === documentId) {
        this.update({ path: document.file });
        void this.reconcile();
      }
    });
    const offDraft = Manager.app.on("document:draft-changed", ({ documentId: id, pending }) => {
      if (id !== documentId) return;
      if (pending) this.changed();
      else queueMicrotask(() => {
        if (!documentDrafts.has(id)) void this.reconcile();
      });
    });
    this.stopEvents = () => { offDocument(); offDraft(); };
    return observer;
  }

  changed() {
    this.generation++;
    if (!this.state.modified) this.update({ modified: true });
  }

  async reconcile() {
    const id = this.documentId;
    const generation = this.generation;
    if (!id) return;
    try {
      const status = await documentFiles.status(id, undefined, this.editingChapter?.snapshot());
      if (this.documentId === id && generation === this.generation) this.update(status);
    } catch (error) {
      this.failed(error, "local-storage");
    }
  }

  failed(error: unknown, code: DocumentSaveErrorCode = "local-storage") {
    const failure: DocumentSaveFailure = {
      code, detail: error instanceof Error ? error.message : String(error), filePath: this.state.path,
    };
    this.showFailure(failure);
    return failure;
  }

  private showFailure(error: DocumentSaveFailure) {
    this.update({ error });
    toast.error(t(error.code === "local-cache" ? "editor.save.cache_failed" : "editor.save.failed"), {
      description: t(`editor.save.errors.${error.code}`),
    });
  }

  async save(archive: CapturedDocumentArchive, mode: DocumentSaveMode = "save"): Promise<DocumentSaveResult> {
    if (this.state.saving) return { status: "cancelled" };
    this.update({ saving: true, error: undefined });
    let result: DocumentSaveResult | undefined;
    try {
      result = await useIPC("editor").editor.save(archive.buffer, archive.fileName, mode);
      await this.applyResult(archive, result);
      return result;
    } catch (error) {
      const failure = this.failed(error, result?.status === "saved" ? "local-cache" : "io");
      return { status: "failed", error: failure };
    } finally {
      this.update({ saving: false });
    }
  }

  private async applyResult(archive: CapturedDocumentArchive, result: DocumentSaveResult) {
    switch (result.status) {
      case "saved":
        await this.completeSave(archive, result);
        return;
      case "reload":
        await this.reload(archive);
        return;
      case "failed":
        this.showFailure(result.error);
        return;
      case "cancelled":
        if (result.reason === "external-change") this.update({ externalChanged: true });
        if (result.reason === "source-missing") this.update({ missing: true });
    }
  }

  private async completeSave(archive: CapturedDocumentArchive, result: Extract<DocumentSaveResult, { status: "saved" }>) {
    this.update({ path: result.filePath, missing: false, externalChanged: false, savedAt: result.savedAt });
    if (archive.draft && documentDrafts.get(archive.document.id) === archive.draft) {
      await archive.draft.commit();
    }
    await documentFiles.bind(archive.document.id, result.filePath);
    await documentFiles.saved(archive.document.id, archive.buffer, result.savedAt);
    await this.reconcile();
  }

  async reload(archive: CapturedDocumentArchive) {
    const wasInert = document.body.inert;
    document.body.inert = true;
    try {
      await this.editingChapter?.flush();
      await documentDrafts.get(archive.document.id)?.commit();
      await useIPC("editor").editor.reloadSource();
    } catch (error) {
      document.body.inert = wasInert;
      throw error;
    }
  }

  stop() {
    this.generation++;
    this.documentId = undefined;
    this.controller?.abort();
    this.stopEvents?.();
    this.controller = undefined;
    this.stopEvents = undefined;
  }
}

export const documentSaving = new DocumentSaving();
