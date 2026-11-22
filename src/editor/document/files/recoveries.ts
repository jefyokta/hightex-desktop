import { HighTexDB } from "../../storage/hightex-db";
import { HighTexImporter } from "@/utils/import-v2";
import { documentFileRevision } from "./revision";
import { Manager } from "../../manager";
import { t } from "@/utils/lang";
import type { RecoveryDocument } from "./contracts";

export class DocumentRecoveries {
  async list(sourceDocumentId?: string): Promise<RecoveryDocument[]> {
    const documents = await HighTexDB.getInstance().documents.toArray();
    return documents
      .filter((document): document is RecoveryDocument => {
        if (!document.recovery) return false;
        return !sourceDocumentId || document.recovery.sourceDocumentId === sourceDocumentId;
      })
      .sort((left, right) => right.recovery.createdAt - left.recovery.createdAt);
  }

  async preserve(source: HighTexDocument, bytes: Uint8Array): Promise<HighTexDocument> {
    const db = HighTexDB.getInstance();
    const revision = await documentFileRevision(bytes);
    const importer = await HighTexImporter.create(new File([new Uint8Array(bytes)], "recovery.hightex"), "");
    const copy = await importer.import("copy");
    copy.title = t("open_file.recovery_title", { title: source.title });
    copy.recovery = {
      sourceDocumentId: source.id, sourceTitle: source.title,
      sourceFile: source.file, createdAt: Date.now(), revision,
    };
    await db.documents.put(copy);
    Manager.app.dispatch("document:updated", { document: copy });
    return copy;
  }
}

export const documentRecoveries = new DocumentRecoveries();
