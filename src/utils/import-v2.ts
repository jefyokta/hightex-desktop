import { JSONContent } from "@tiptap/core";
import { unzipSync, strFromU8 } from "fflate";
import { HighTexDB } from "@/editor/storage/hightex-db";
import { Storage } from "@/editor/storage";
import { HighTexImportError } from "@/exception/hightex-import";
import { ShouldNotified } from "@/exception/interfaces/should-notified";
import { Document } from "@/editor/document";

export class HighTexImporter {
  public context!: ImportContext;

  static async create(file: File) {
    const importer = new HighTexImporter();
    await importer.init(file);
    return importer;
  }

  private async init(file: File) {
    const buffer = await file.arrayBuffer();
    const entries = unzipSync(new Uint8Array(buffer));

    const manifest = this.findManifest(entries);

    const documentId = manifest?.document?.id || "";

    const db = HighTexDB.getInstance();
    const doc = await db.documents.get(documentId);
    const exists = !!doc;

    this.context = {
      file,
      buffer,
      entries,
      manifest,
      documentId,
      actualDocumentId: doc?.id || documentId,
      exists,
      db,
    };
  }

  get manifest() {
    return this.context.manifest;
  }

  get entries() {
    return this.context.entries;
  }

  get exists() {
    return this.context.exists;
  }

  get actualDocumentId() {
    return this.context.actualDocumentId;
  }

  async import() {
    try {
      const document = await this.createDocument();

      await this.importChapters(document.id);
      await this.importReferences();
      await this.importImages(document.id);
      await this.importVariables()
      await Storage.instance.setDocument(document);

      const doc = new Document(document.id);
      await doc.warm();
      doc.destroy();

      return document;
    } catch (error) {
      if (error instanceof ShouldNotified) {
        throw error;
      }

      const message = error instanceof Error ? error.message : String(error);

      throw new HighTexImportError(message);
    }
  }

 async importVariables(){
    const vars = this.entries['files/assets/variables.json']
    if(!vars) return
    try {
      const vs= JSON.parse(strFromU8(vars)) as Variable[] || []
      for (const v of vs){
        console.log(v)
      await  this.context.db.setVar(v.name,v.value,this.context.actualDocumentId)
      }

    } catch (error) {
      
    }
  }

  async createDocument(): Promise<HighTexDocument> {
    const manifest = this.manifest;

    const remoteCategories = await window.hightex.categories();

    const categoryId = manifest.document?.category;

    const category =
      remoteCategories.find((item) => item.id.toString() === categoryId) ??
      remoteCategories[0];

    return {
      id: this.actualDocumentId,
      category: category?.id.toString() ?? "0",
      title: manifest.document?.title?.id ?? "Imported Document",
      altTitle: manifest.document?.title?.en ?? "",
      keywords: normalizeKeywords(manifest.document?.keywords),
      config: {},
      updatedAt: new Date(),
    } satisfies Omit<HighTexDocument, "file">;
  }

  async importChapters(documentId: string) {
    const keys = Object.keys(this.entries);

    const chapterKeys = keys.filter((k) => k.startsWith("files/chapters/"));

    for (const key of chapterKeys) {
      const entry = this.entries[key];
      if (!entry) continue;

      const fileName = key.split("/").pop() ?? key;
      const chapterName = mapFileToChapterName(
        fileName.replace(/\.json$/i, ""),
      );

      const content = normalizeChapterContent(JSON.parse(strFromU8(entry)));

      const chapterId = `${documentId}.${chapterName}`;

      await this.context.db.chapters.put({ id: chapterId, content });
    }
  }

  async importReferences() {
    const entry = findZipEntry(this.entries, "files/assets/references.json");
    if (!entry) return;

    const refs = JSON.parse(strFromU8(entry));

    await this.context.db.cite.bulkPut(convertReferenceToCollection(refs));
  }

  async importImages(documentId: string) {
    const keys = Object.keys(this.entries).filter(
      (k) => k.endsWith(".webp") && k.includes("files/assets/images/"),
    );

    for (const key of keys) {
      const entry = this.entries[key];
      if (!entry) continue;

      const fileName = key.split("/").pop() ?? key;
      const id = fileName.replace(/\.webp$/i, "");

      const blob = new Blob([entry.slice().buffer], { type: "image/webp" });

      const record: ImageRecord = {
        id,
        blob,
        documentId,
        createdAt: Date.now(),
      };

      try {
        await this.context.db.images.add(record);
      } catch (e) {
        // if exists, replace
        await this.context.db.images.put(record);
      }
    }
  }

  getConfig() {
    const configEntry = findZipEntry(this.entries, "files/config.json");

    if (!configEntry) return {};

    const raw = JSON.parse(strFromU8(configEntry));

    return {
      consentDate: parseDateField(raw.consentDate),
      validityDate: parseDateField(raw.validityDate),
      statementDate: parseDateField(raw.statementDate),
      leader: raw.leader,
      member_1: raw.member_1,
      member_2: raw.member_2,
    };
  }

  private findManifest(entries: Record<string, Uint8Array>) {
    const manifestEntryKey = Object.keys(entries).find((name) =>
      name.endsWith("manifest.json"),
    );

    if (!manifestEntryKey) {
      throw new HighTexImportError(
        "manifest.json not found in HighTex package.",
      );
    }

    return JSON.parse(
      strFromU8(entries[manifestEntryKey]),
    ) as HighTexManifestV2;
  }
}

export async function importHighTexV2Package(file: File) {
  const importer = await HighTexImporter.create(file);

  return importer.import();
}

const normalizeKeywords = (
  keywords: HighTexManifestV2["document"]["keywords"],
): Keywords => {
  return {
    indonesian: Array.isArray(keywords?.id) ? keywords.id : [],
    english: Array.isArray(keywords?.en) ? keywords.en : [],
  };
};

const normalizeChapterContent = (value: any): JSONContent[] => {
  if (Array.isArray(value)) {
    return value;
  }

  if (value && Array.isArray(value?.content)) {
    return value.content;
  }

  if (value) {
    return [value];
  }

  return [];
};

const parseDateField = (value: unknown): Date | undefined => {
  if (!value) return undefined;

  const date = new Date(String(value));

  return Number.isNaN(date.getTime()) ? undefined : date;
};

const mapFileToChapterName = (filePath: string) => {
  const fileName = filePath.split("/").pop() ?? "";

  const map: Record<string, string> = {
    id: "abstract",
    en: "abstract-en",
    "abstract-en": "abstract-en",
    abstract: "abstract",
    foreword: "foreword",
    presentation: "presentation",
    attachment: "attachment",
    reference: "reference",
    config: "config",
    document: "document",
  };

  return map[fileName] ?? fileName;
};

const findZipEntry = (entries: Record<string, Uint8Array>, path: string) => {
  const normalized = path.replace(/^\/+/, "");

  if (entries[normalized]) {
    return entries[normalized];
  }

  const match = Object.keys(entries).find((key) => key.endsWith(normalized));

  return match ? entries[match] : undefined;
};

const convertReferenceToCollection = (record: Record<string, string>) => {
  return Object.keys(record).map((key) => ({
    key,
    bib: record[key],
  })) satisfies CiteRecord[];
};
