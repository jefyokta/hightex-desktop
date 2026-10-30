import { HighTexDB } from "@/editor/storage/hightex-db";
import { contentAssets } from "./content-assets";

const findUnused = async (db: HighTexDB) => {
  const [citations, chapters] = await Promise.all([
    db.cite.toArray(),
    db.chapters.toArray(),
  ]);
  const used = contentAssets(chapters).references;
  return citations.filter((citation) => !used.has(citation.key));
};

export const getUnusedCitations = async (): Promise<CiteRecord[]> => {
  const db = HighTexDB.getInstance();
  return db.transaction("r", db.cite, db.chapters, () => findUnused(db));
};

/** Recheck usage and delete only the candidates the user reviewed. */
export const deleteUnusedCitation = async (keys: string[]): Promise<number> => {
  const db = HighTexDB.getInstance();
  const candidates = new Set(keys);
  return db.transaction("rw", db.cite, db.chapters, async () => {
    const unused = await findUnused(db);
    const removable = unused
      .filter((citation) => candidates.has(citation.key))
      .map((citation) => citation.key);
    await db.cite.bulkDelete(removable);
    return removable.length;
  });
};
