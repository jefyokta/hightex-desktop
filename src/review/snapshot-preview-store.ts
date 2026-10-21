import Dexie from "dexie";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { strFromU8, unzipSync } from "fflate";
import { HighTexDB } from "@/editor/storage/hightex-db";
import { isProfileVariable } from "@/utils/document-profile";
import type { SnapshotReadModel } from "./snapshot-reader";
import type { JSONContent } from "@tiptap/core";

const date = (value: unknown) => {
  if (!value) return undefined;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

// The existing print components run inside a dedicated iframe. Their database
// is a private in-memory instance; the parent editor and browser IndexedDB stay untouched.
export const createSnapshotPreviewStore = async (
  snapshot: SnapshotReadModel,
  categories: Category[],
) => {
  const entries = unzipSync(snapshot.originalFile());
  const json = (path: string): unknown =>
    entries[path] ? JSON.parse(strFromU8(entries[path])) : undefined;
  const manifest = json("manifest.json") as {
    schema_version?: number;
    document?: { category?: { name?: string } };
  };
  const category = categories.find((category) =>
    manifest.schema_version === 1
      ? category.name === manifest.document?.category?.name
      : String(category.id) === snapshot.document.category,
  );
  if (!category) throw new Error("snapshot_category_missing");

  const originalIndexedDB = Dexie.dependencies.indexedDB;
  const originalRange = Dexie.dependencies.IDBKeyRange;
  let db: HighTexDB;
  try {
    Dexie.dependencies.indexedDB = new IDBFactory();
    Dexie.dependencies.IDBKeyRange = IDBKeyRange;
    // Prevent the compiler's normal warm-up from adding unrelated default references.
    class PreviewStore extends HighTexDB {
      async warm() {}
    }
    db = new PreviewStore(`SubmissionPreview-${crypto.randomUUID()}`);
  } finally {
    Dexie.dependencies.indexedDB = originalIndexedDB;
    Dexie.dependencies.IDBKeyRange = originalRange;
  }

  try {
    await db.open();
    await db.cite.clear();
    const document: HighTexDocument = {
      ...structuredClone(snapshot.document),
      category: String(category.id),
    };
    for (const key of ["statementDate", "consentDate", "validityDate"] as const)
      document.config[key] = date(document.config[key]);
    if (document.config.intern)
      document.config.intern.validity = date(document.config.intern.validity);
    const content = (nodes: readonly JSONContent[]): JSONContent[] =>
      nodes.map((node) => {
        const copy = structuredClone(node);
        if (copy.type === "image" && copy.attrs) {
          const src = String(copy.attrs.src ?? "");
          if (
            !snapshot.images.has(src) &&
            !/^data:image\/(?:png|jpeg|webp);base64,[a-zA-Z0-9+/=\s]+$/.test(
              src,
            )
          )
            copy.attrs.src = "";
        }
        if (copy.content) copy.content = content(copy.content);
        return copy;
      });
    await db.documents.put(document);
    for (const chapter of snapshot.chapters) {
      const name =
        { id: "abstract", en: "abstract-en" }[chapter.id] ?? chapter.id;
      await db.chapters.put({
        id: `${document.id}.${name}`,
        content: content(chapter.content),
      });
    }
    for (const [id, blob] of snapshot.images)
      await db.images.put({ id, blob, documentId: document.id, createdAt: 0 });
    await db.cite.bulkPut(
      Object.entries(snapshot.references).map(([key, bib]) => ({ key, bib })),
    );
    const variables = json("files/assets/variables.json") as
      | Array<{ name: string; value: string }>
      | undefined;
    for (const variable of variables ?? [])
      if (!isProfileVariable(variable.name))
        await db.setVar(variable.name, variable.value, document.id);
    const aliases = json("files/assets/aliases.json");
    if (aliases !== undefined) {
      if (
        !Array.isArray(aliases) ||
        aliases.some(
          (alias) =>
            !alias ||
            typeof alias.key !== "string" ||
            typeof alias.value !== "string",
        )
      )
        throw new Error("invalid_content");
      for (const alias of aliases as Array<{ key: string; value: string }>)
        await db.setAlias(
          alias.key.startsWith(`${document.id}.`)
            ? alias.key.slice(document.id.length + 1)
            : alias.key,
          alias.value,
          document.id,
        );
    }
    return { db, category };
  } catch (error) {
    await db.delete();
    throw error;
  }
};
