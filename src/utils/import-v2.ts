import type { ImportedHighTexV2 } from "@hightex/importer";
import { HighTexDB } from "@/editor/storage/hightex-db";
import { HighTexImportError } from "@/exception/hightex-import";
import { ShouldNotified } from "@/exception/interfaces/should-notified";
import { Document } from "@/editor/document";
import {
  captureDraft,
  installDraft,
  prepareDraftImport,
  type DraftState,
} from "./htx/draft-transfer";
import { archiveSha256, readImportModel } from "./htx/import-model";
import { t } from "./lang";

export type ImportMode = "overwrite" | "copy";

/** Desktop persistence adapter; archive parsing belongs to @hightex/importer. */
export class HighTexImporter {
  private constructor(
    readonly model: ImportedHighTexV2,
    readonly filePath: string,
    private readonly hash: string,
    private readonly before: DraftState,
  ) {}

  static async create(file: File, filePath: string) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const model = readImportModel(bytes);
    const before = await captureDraft(
      HighTexDB.getInstance(),
      model.document.id,
    );
    return new HighTexImporter(
      model,
      filePath,
      await archiveSha256(bytes),
      before,
    );
  }

  get exists() {
    return !!this.before.document;
  }
  get actualDocumentId() {
    return this.model.document.id;
  }

  async import(mode: ImportMode = "overwrite"): Promise<HighTexDocument> {
    try {
      const db = HighTexDB.getInstance();
      const documentId =
        mode === "copy" ? crypto.randomUUID() : this.actualDocumentId;
      const before =
        mode === "copy" ? await captureDraft(db, documentId) : this.before;
      const categories = await window.hightex.categories();
      const prepared = await prepareDraftImport(
        this.model,
        documentId,
        categories,
        `local_${documentId}_${this.hash.slice(0, 16)}_`,
      );
      if (mode === "copy") {
        prepared.state.document.title = t("open_file.copy_title", {
          title: prepared.state.document.title,
        });
        delete prepared.state.document.file;
      } else {
        prepared.state.document.file = this.filePath;
      }
      await installDraft(db, prepared, before);
      // Editor setup follows the database commit and runs outside its transaction.
      const doc = new Document(documentId);
      try {
        await doc.warm();
      } finally {
        doc.destroy();
      }
      return prepared.state.document;
    } catch (error) {
      if (error instanceof ShouldNotified) throw error;
      throw new HighTexImportError(
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}
