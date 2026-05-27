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
  if (entries[normalized]) return entries[normalized];

  const match = Object.keys(entries).find((key) => key.endsWith(normalized));
  return match ? entries[match] : undefined;
};

export async function importHighTexPackage(file: File) {
  try {
    const buffer = await file.arrayBuffer();
    const entries = unzipSync(new Uint8Array(buffer));

    const manifestEntryKey = Object.keys(entries).find((name) =>
      name.endsWith("manifest.json"),
    );
    if (!manifestEntryKey) {
      throw new HighTexImportError(
        "manifest.json not found in HighTex package.",
      );
    }

    const manifestJson = strFromU8(entries[manifestEntryKey]);
    const manifest = JSON.parse(manifestJson) as HighTexManifest;
    const remoteCategories = await window.hightex.categories();
    const category =
      remoteCategories.find(
        (item) => item.name === manifest.document?.category?.name,
      ) ?? remoteCategories[0];

    const documentId = manifest.document?.id ?? crypto.randomUUID();
    const db = HighTexDB.getInstance();
    const existing = await db.documents.get(documentId);
    const id = existing ? crypto.randomUUID() : documentId;

    const document: HighTexDocument = {
      id,
      category: category?.id.toString() ?? "0",
      title: manifest.document?.title?.main ?? "Imported Document",
      altTitle: manifest.document?.title?.alt ?? "",
      keywords: normalizeKeywords(manifest.document?.keywords),
      config: {},
      updatedAt: new Date(),
    };

    if (manifest.structure?.chapters && manifest.structure.chapters.length) {
      for (const chapterMeta of manifest.structure.chapters) {
        const chapterEntry = findZipEntry(entries, chapterMeta.file);
        if (!chapterEntry) continue;

        const chapterName = mapFileToChapterName(chapterMeta.file);
        if (chapterName === "config" || chapterName === "document") {
          if (chapterName === "config") {
            const rawConfig = JSON.parse(strFromU8(chapterEntry));
            document.config = {
              consentDate: parseDateField(rawConfig.consentDate),
              validityDate: parseDateField(rawConfig.validityDate),
              statementDate: parseDateField(rawConfig.statementDate),
              leader: rawConfig.leader,
              member_1: rawConfig.member_1,
              member_2: rawConfig.member_2,
            };
          }
          continue;
        }

        const content = normalizeChapterContent(
          JSON.parse(strFromU8(chapterEntry)),
        );
        const chapterId = `${id}.${chapterName}`;
        await db.chapters.put({ id: chapterId, content });
      }
    }

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
