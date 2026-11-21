import { Manager } from "../manager";
import { documentDrafts } from "../document-drafts";
import { observeDocumentSources } from "../storage/document-source-observer";
import { documentFiles } from "./file-source";
import type { CapturedDocumentArchive } from "./archive";
import { toast } from "sonner";
import { t } from "@/utils/lang";
import type { JSONContent } from "@tiptap/core";

export interface DocumentSaveState {
  ready: boolean;
  path?: string;
  savedAt?: number;
  missing: boolean;
  modified: boolean;
  saving: boolean;
  error?: DocumentSaveFailure;
  externalChanged?: boolean;
}

/** The renderer session owns save state across chapters and both save entry points. */
export class DocumentSaving {
  private state: DocumentSaveState = { ready: false, missing: false, modified: true, saving: false };
  private listeners = new Set<() => void>();
  private documentId?: string;
  private controller?: AbortController;
  private stopEvents?: () => void;
  private generation = 0;
  private chapterBuffer?: () => { id: string; content: JSONContent[] } | undefined;
  private flushChanges?: () => Promise<void>;

  read = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  private update(patch: Partial<DocumentSaveState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach(listener => listener());
  }

  watchChapter(buffer: () => { id: string; content: JSONContent[] } | undefined, flush: () => Promise<void>) {
    this.chapterBuffer = buffer;
    this.flushChanges = flush;
    return () => {
      if (this.chapterBuffer === buffer) {
        this.chapterBuffer = undefined;
        this.flushChanges = undefined;
      }
    };
  }

  async start(documentId: string, bytes: Uint8Array) {
    this.stop();
    this.documentId = documentId;
    this.update({ ready: true, saving: false, error: undefined, externalChanged: false, ...await documentFiles.status(documentId, bytes) });
    const controller = this.controller = new AbortController();
    const observer = observeDocumentSources([documentId], () => {
      const wasClean = !this.state.modified;
      this.changed();
      // Reconcile the first notification after a clean save; editing never re-exports ZIPs.
      if (wasClean && !this.state.saving) void this.reconcile();
    }, controller.signal, { ignoreFileMetadata: true });
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
    await observer.ready;
    await this.reconcile();
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
      const status = await documentFiles.status(id, undefined, this.chapterBuffer?.());
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
    let fileWritten = false;
    try {
      const result = await window.editor.save(archive.buffer, archive.fileName, mode);
      if (result.status === "cancelled" && result.reason === "external-change")
        this.update({ externalChanged: true });
      if (result.status === "cancelled" && result.reason === "source-missing")
        this.update({ missing: true });
      if (result.status === "failed") this.showFailure(result.error);
      if (result.status === "reload") {
        // The reopened session preserves any differing committed draft before installing the file.
        await this.reload(archive);
      }
      if (result.status === "saved") {
        fileWritten = true;
        this.update({ path: result.filePath, missing: false, externalChanged: false, savedAt: result.savedAt });
        if (archive.draft && documentDrafts.get(archive.document.id) === archive.draft)
          await archive.draft.commit();
        await documentFiles.bind(archive.document.id, result.filePath);
        await documentFiles.saved(archive.document.id, archive.buffer, result.savedAt);
        await this.reconcile();
      }
      return result;
    } catch (error) {
      this.failed(error, fileWritten ? "local-cache" : "io");
      return { status: "failed", error: this.state.error! };
    } finally {
      this.update({ saving: false });
    }
  }

  async reload(archive: CapturedDocumentArchive) {
    const wasInert = document.body.inert;
    document.body.inert = true;
    try {
      await this.flushChanges?.();
      await documentDrafts.get(archive.document.id)?.commit();
      await window.editor.reloadSource();
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
