import { JSONContent } from "@tiptap/core";
import { unzipSync, strFromU8 } from "fflate";
import { HighTexDB } from "@/editor/storage/hightex-db";
import { Storage } from "@/editor/storage";
import { HighTexImportError } from "@/exception/hightex-import";
import { ShouldNotified } from "@/exception/interfaces/should-notified";
import { Document } from "@/editor/document";

interface HighTexManifest {
  document: {
    id: string;
    title: {
      main: string;
      alt?: string;
    };
    keywords?: {
      indonesian?: string[];
      english?: string[];
    };
    category?: {
      name?: string;
      chapters?: number;
    };
  };
  structure?: {
    chapters?: Array<{ file: string; id: string }>;
    assets?: string[];
    excluded?: string[];
  };
}

type ImportContext = {
  file: File;
  buffer: ArrayBuffer;
  entries: Record<string, Uint8Array>;
  manifest: HighTexManifest;
  documentId: string;
  actualDocumentId: string;
  exists: boolean;
  db: HighTexDB;
};

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

    const documentId = manifest.document?.id ?? crypto.randomUUID();

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

  async createDocument(): Promise<HighTexDocument> {
    const manifest = this.manifest;

    const remoteCategories = await window.hightex.categories();

    const category =
      remoteCategories.find(
        (item) => item.name === manifest.document?.category?.name,
      ) ?? remoteCategories[0];

    return {
      id: this.actualDocumentId,
      category: category?.id.toString() ?? "0",
      title: manifest.document?.title?.main ?? "Imported Document",
      altTitle: manifest.document?.title?.alt ?? "",
      keywords: normalizeKeywords(manifest.document?.keywords),
      config: {},
      updatedAt: new Date(),
    };
  }

  async importChapters(documentId: string) {
    const chapters = this.manifest.structure?.chapters ?? [];

    for (const chapterMeta of chapters) {
      await this.importChapter(documentId, chapterMeta);
    }
  }

  async importChapter(
    documentId: string,
    chapterMeta: {
      file: string;
      id: string;
    },
  ) {
    const chapterEntry = findZipEntry(this.entries, chapterMeta.file);

    if (!chapterEntry) return;

    const chapterName = mapFileToChapterName(chapterMeta.file);

    if (chapterName === "reference") {
      const refs = JSON.parse(strFromU8(chapterEntry));

      await this.context.db.cite.bulkPut(convertReferenceToCollection(refs));

      return;
    }

    if (chapterName === "config" || chapterName === "document") {
      return;
    }

    const content = normalizeChapterContent(
      JSON.parse(strFromU8(chapterEntry)),
    );

    const chapterId = `${documentId}.${chapterName}`;

    await this.context.db.chapters.put({
      id: chapterId,
      content,
    });
  }

  getConfig() {
    const configEntry = findZipEntry(this.entries, "config.json");

    if (!configEntry) {
      return {};
    }

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

    return JSON.parse(strFromU8(entries[manifestEntryKey])) as HighTexManifest;
  }
}

export async function importHighTexPackage(file: File) {
  const importer = await HighTexImporter.create(file);

  return importer.import();
}

const normalizeKeywords = (keywords: any): Keywords => {
  return {
    indonesian: Array.isArray(keywords?.indonesian) ? keywords.indonesian : [],
    english: Array.isArray(keywords?.english) ? keywords.english : [],
  };
};

const normalizeChapterContent = (value: any): JSONContent[] => {
  if (Array.isArray(value)) {
    return value;
  }

  if (value && Array.isArray(value.content)) {
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
  const fileName =
    filePath
      .split("/")
      .pop()
      ?.replace(/\.json$/i, "") ?? "";

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
