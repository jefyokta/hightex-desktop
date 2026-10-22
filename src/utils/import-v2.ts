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

  async import(): Promise<HighTexDocument> {
    try {
      const db = HighTexDB.getInstance();
      const categories = await window.hightex.categories();
      const prepared = await prepareDraftImport(
        this.model,
        this.actualDocumentId,
        categories,
        `local_${this.actualDocumentId}_${this.hash.slice(0, 16)}_`,
      );
      prepared.state.document.file = this.filePath;
      await installDraft(db, prepared, this.before);
      // Editor setup follows the database commit and runs outside its transaction.
      const doc = new Document(this.actualDocumentId);
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
