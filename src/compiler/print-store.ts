import Dexie from "dexie";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { HighTexDB } from "@/editor/storage/hightex-db";
import { contentAssets } from "@/utils/content-assets";

/** Capture one database revision, then keep all compiler writes in memory. */
export async function createDocumentPrintStore(documentId: string) {
  const source = HighTexDB.getInstance();
  const snapshot = await source.transaction("r", source.tables, async () => {
    const document = await source.documents.get(documentId);
    if (!document) throw new Error("Document not found");
    const chapters = await source.chapters
      .where("id")
      .startsWith(`${documentId}.`)
      .toArray();
    const assets = contentAssets(chapters);
    return {
      document,
      chapters,
      references: await source.cite
        .filter(
          (cite) =>
            !cite.documentId ||
            cite.documentId === documentId ||
            assets.references.has(cite.key),
        )
        .toArray(),
      images: await source.images
        .filter(
          (image) =>
            image.documentId === documentId || assets.images.has(image.id),
        )
        .toArray(),
      variables: await source.documentVariables
        .filter(
          (variable) =>
            variable.documentId === documentId ||
            variable.documentId === "global",
        )
        .toArray(),
      aliases: await source.aliases
        .where("documentId")
        .equals(documentId)
        .toArray(),
    };
  });

  const indexedDB = Dexie.dependencies.indexedDB;
  const keyRange = Dexie.dependencies.IDBKeyRange;
  let db: HighTexDB;
  try {
    Dexie.dependencies.indexedDB = new IDBFactory();
    Dexie.dependencies.IDBKeyRange = IDBKeyRange;
    class PrintStore extends HighTexDB {
      async warm() {}
    }
    db = new PrintStore(`DocumentPrint-${crypto.randomUUID()}`);
  } finally {
    Dexie.dependencies.indexedDB = indexedDB;
    Dexie.dependencies.IDBKeyRange = keyRange;
  }
  try {
    await db.open();
    await db.transaction("rw", db.tables, async () => {
      await db.cite.clear();
      await db.documents.put(snapshot.document);
      await db.chapters.bulkPut(snapshot.chapters);
      await db.cite.bulkPut(snapshot.references);
      await db.images.bulkPut(snapshot.images);
      await db.documentVariables.bulkPut(snapshot.variables);
      await db.aliases.bulkPut(snapshot.aliases);
    });
    return db;
  } catch (error) {
    await db.delete();
    throw error;
  }
}
