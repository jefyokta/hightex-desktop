import { HighTexDB } from "../storage/hightex-db";
import { HighTexImporter } from "@/utils/import-v2";
import { Exporter } from "@/utils/htx/exporter";
import { documentFileRevision as revision } from "./file-revision";
import { documentRecoveries } from "./recoveries";
import { documentRenderFingerprint, documentRenderModel } from "./render-model";
import { readImportModel } from "@/utils/htx/import-model";
import type { JSONContent } from "@tiptap/core";
import { readDocumentSnapshot } from "../storage/document-snapshot";
import { documentDrafts } from "../document-drafts";
import { Manager } from "../manager";
import { toast } from "sonner";
import { t } from "@/utils/lang";
import { Document } from ".";
import { ShouldNotified } from "@/exception/interfaces/should-notified";

interface FileBaseline {
  filePath: string;
  documentId: string;
  draftRevision: string;
  savedAt?: number;
  presentationRevision?: string;
}

/** One renderer owns one editing session, including chapter navigation and StrictMode. */
export class DocumentFileSource {
  private readonly sessions = new Map<string, Promise<void>>();
  private readonly awaitingNormalization = new Map<string, Uint8Array<ArrayBuffer>>();
  private readonly unavailable = new Set<string>();

  /** Read the source before mounting the first editor, never while editing. */
  load(documentId: string): Promise<void> {
    let pending = this.sessions.get(documentId);
    if (!pending) {
      pending = this.readSource(documentId).catch((error) => {
        this.sessions.delete(documentId);
        throw error;
      });
      this.sessions.set(documentId, pending);
    }
    return pending;
  }

  /** Accept editor normalization only after a successful file read. */
  async initialized(documentId: string, bytes: Uint8Array) {
    const source = this.awaitingNormalization.get(documentId);
    if (!source) return;
    await this.saved(documentId, bytes);
    return source;
  }

  /** Track the exact content saved, even if editing continued during the write. */
  async saved(documentId: string, bytes: Uint8Array, savedAt?: number) {
    const db = HighTexDB.getInstance();
    const document = await db.documents.get(documentId);
    if (!document?.file) return;
    const previous = await db.table<FileBaseline>("file").get(document.file);
    await db.table<FileBaseline>("file").put({
      filePath: document.file,
      documentId,
      draftRevision: await revision(bytes),
      presentationRevision: await documentRenderFingerprint(readImportModel(bytes)),
      savedAt: savedAt ?? previous?.savedAt,
    });
    this.awaitingNormalization.delete(documentId);
    this.unavailable.delete(documentId);
  }

  async status(documentId: string, bytes?: Uint8Array, buffer?: { id: string; content: JSONContent[] }) {
    const db = HighTexDB.getInstance();
    const document = await db.documents.get(documentId);
    const path = document?.file;
    const record = path ? await db.table<FileBaseline>("file").get(path) : undefined;
    const baseline = record?.documentId === documentId ? record : undefined;
    const status = { path, savedAt: baseline?.savedAt, missing: this.unavailable.has(documentId) };
    if (!baseline) return { ...status, modified: true };
    let model;
    if (bytes) model = readImportModel(bytes);
    else {
      const snapshot = await readDocumentSnapshot(documentId, { draft: documentDrafts.get(documentId)?.document });
      // Never show a clean file while the live chapter still has uncommitted edits.
      if (buffer && JSON.stringify(snapshot.chapters.find(chapter => chapter.id === buffer.id)?.content) !== JSON.stringify(buffer.content))
        return { ...status, modified: true };
      model = await documentRenderModel(snapshot);
    }
    return {
      ...status,
      modified: baseline.presentationRevision
        ? await documentRenderFingerprint(model) !== baseline.presentationRevision
        : await revision(model) !== baseline.draftRevision,
    };
  }

  async bind(documentId: string, path: string) {
    const active = Document.instance;
    if (active?.id === documentId) await active.setFilePath(path);
    else await HighTexDB.getInstance().documents.update(documentId, { file: path });
  }

  async locate(documentId: string): Promise<void> {
    try {
      const db = HighTexDB.getInstance();
      const stored = await db.documents.get(documentId);
      const path = await window.editor.locateSource();
      if (!path) return;
      const baseline = stored?.file
        ? await db.table<FileBaseline>("file").get(stored.file)
        : undefined;
      await this.bind(documentId, path);
      // Reconnecting a file must not mark unsaved edits as saved.
      if (baseline?.documentId === documentId)
        await db.table<FileBaseline>("file").put({ ...baseline, filePath: path });
      this.unavailable.delete(documentId);
      const document = await db.documents.get(documentId);
      if (document) Manager.app.dispatch("document:updated", { document });
      toast.success(t("open_file.source_reconnected"), {
        description: t("open_file.source_reconnected_description"),
      });
    } catch (error) {
      toast.error(t("open_file.locate_failed"), {
        description: error instanceof ShouldNotified
          ? error.description
          : error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async readSource(documentId: string) {
    const db = HighTexDB.getInstance();
    const stored = await db.documents.get(documentId);
    const path = await window.editor.sourceFile(documentId, stored?.file);
    if (!path) return;

    let bytes: Uint8Array<ArrayBuffer>;
    try {
      bytes = new Uint8Array(await window.hightex.readFile(path));
    } catch (error) {
      if (!stored) throw error;
      this.unavailable.add(documentId);
      toast.warning(t("open_file.source_unavailable"), {
        description: path,
        action: {
          label: t("open_file.locate_source"),
          onClick: () => { void this.locate(documentId); },
        },
      });
      return;
    }

    const importer = await HighTexImporter.create(
      new File([bytes], "source.hightex"), path,
    );
    if (importer.actualDocumentId !== documentId)
      throw Error(t("open_file.source_identity_changed"));

    if (stored) {
      const archive = await new Exporter(documentId).buildExport();
      const baseline = await db.table<FileBaseline>("file").get(path);
      const expected = baseline?.documentId === documentId
        ? baseline.draftRevision : await revision(bytes);
      if (await revision(archive.buffer) !== expected)
        await this.recover(stored, archive.buffer);
    }

    const document = await importer.import();
    const normalized = await new Exporter(documentId).buildExport();
    await this.saved(documentId, normalized.buffer);
    this.awaitingNormalization.set(documentId, bytes);
    Manager.app.dispatch("document:updated", { document });
  }

  private async recover(stored: HighTexDocument, bytes: Uint8Array) {
    const recovery = await documentRecoveries.preserve(stored, bytes);
    toast.info(t("open_file.recovery_saved"), {
      description: recovery.title,
      action: {
        label: t("open_file.open_recovery"),
        onClick: () => window.editor.open(recovery.id),
      },
    });
  }
}

export const documentFiles = new DocumentFileSource();
