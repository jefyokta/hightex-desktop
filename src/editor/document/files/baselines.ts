import { HighTexDB } from "../../storage/hightex-db";
import { readDocumentSnapshot } from "../../storage/document-snapshot";
import { documentDrafts } from "../../document-drafts";
import { documentRenderFingerprint, documentRenderModel } from "../render-model";
import { readImportModel } from "@/utils/htx/import-model";
import { documentFileRevision } from "./revision";
import type { ChapterBuffer, FileBaseline } from "./contracts";
import type { DocumentRenderModel } from "@/types/document-snapshot";

/** Own the persisted revision of a file, independently of the open editor session. */
export class FileBaselines {
  private get records() {
    return HighTexDB.getInstance().table<FileBaseline>("file");
  }

  async find(filePath: string, documentId: string) {
    const record = await this.records.get(filePath);
    return record?.documentId === documentId ? record : undefined;
  }

  async record(documentId: string, bytes: Uint8Array, savedAt?: number) {
    const document = await HighTexDB.getInstance().documents.get(documentId);
    if (!document?.file) return;

    const previous = await this.records.get(document.file);
    const model = readImportModel(bytes);
    await this.records.put({
      filePath: document.file,
      documentId,
      draftRevision: await documentFileRevision(model),
      presentationRevision: await documentRenderFingerprint(model),
      savedAt: savedAt ?? previous?.savedAt,
    });
  }

  async relocate(documentId: string, previousPath: string | undefined, nextPath: string) {
    if (!previousPath) return;
    const baseline = await this.find(previousPath, documentId);
    if (baseline) await this.records.put({ ...baseline, filePath: nextPath });
  }

  async matches(
    documentId: string,
    baseline: FileBaseline,
    bytes?: Uint8Array,
    buffer?: ChapterBuffer,
  ): Promise<boolean> {
    let model: DocumentRenderModel;
    if (bytes) {
      model = readImportModel(bytes);
    } else {
      const snapshot = await readDocumentSnapshot(documentId, {
        draft: documentDrafts.get(documentId)?.document,
      });
      // An uncommitted editor buffer must never be reported as a clean file.
      if (buffer) {
        const stored = snapshot.chapters.find(chapter => chapter.id === buffer.id);
        if (JSON.stringify(stored?.content) !== JSON.stringify(buffer.content)) return false;
      }
      model = await documentRenderModel(snapshot);
    }

    if (baseline.presentationRevision) {
      return (await documentRenderFingerprint(model)) === baseline.presentationRevision;
    }

    return (await documentFileRevision(model)) === baseline.draftRevision;
  }
}

export const fileBaselines = new FileBaselines();
