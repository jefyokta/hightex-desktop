import { zipSync, strToU8 } from "fflate";
import { HighTexDB } from "@/editor/storage/hightex-db";
import { HighTexExportError } from "@/exception/hightex-export";

const sanitizeFileName = (name: string) =>
  name.replace(/[^a-zA-Z0-9-_\. ]/g, "-").slice(0, 120);

const buildEntryName = (chapterId: string) => {
  return chapterId.split(".")[1] ?? chapterId;
};

const buildCategory = async (categoryId: string) => {
  const categories = await window.hightex.categories();
  const category = categories.find((item) => item.id.toString() === categoryId);

  return {
    name: category?.name ?? "",
    chapters: category?.chapters?.length ?? 0,
  };
};

export async function exportHighTexDocument(documentId: string) {
  const db = HighTexDB.getInstance();
  const document = await db.documents.get(documentId);

  if (!document) {
    throw new HighTexExportError("Document not found for export.");
  }

  const category = await buildCategory(document.category);
  const chapters = await db.chapters
    .where("id")
    .between(`${documentId}.`, `${documentId}.\uffff`)
    .toArray();

  const structureChapters = chapters.map((chapter) => {
    const file = `data/${buildEntryName(chapter.id)}.json`;
    return { file, id: buildEntryName(chapter.id) };
  });
  structureChapters.push({
    file: "data/reference.json",
    id: "reference",
  });

  const manifest = {
    format: "hightex",
    schema_version: 1,
    entry: "document.json",
    document: {
      id: document.id,
      title: {
        main: document.title,
        alt: document.altTitle,
      },
      keywords: document.keywords,
      category,
    },
    author: {
      name: "",
      email: "",
      mentors: [],
    },
    structure: {
      chapters: structureChapters,
      assets: [],
      excluded: [],
    },
    version: null,
    generated_at: new Date().toISOString(),
  };

  const documentJson = {
    id: document.id,
    title: {
      main: document.title,
      alt: document.altTitle,
    },
    keywords: document.keywords,
    category,
    config: {
      ...document.config,
      consentDate: document.config?.consentDate
        ? document.config.consentDate.toISOString()
        : undefined,
      validityDate: document.config?.validityDate
        ? document.config.validityDate.toISOString()
        : undefined,
      statementDate: document.config?.statementDate
        ? document.config.statementDate.toISOString()
        : undefined,
    },
  };

  const entries: Record<string, Uint8Array> = {
    "manifest.json": strToU8(JSON.stringify(manifest)),
    "document.json": strToU8(JSON.stringify(documentJson)),
    "meta/export.json": strToU8(
      JSON.stringify(
        {
          exported_by: "HighTex Engine",
          timestamp: new Date().toISOString(),
        },
        null,
        2,
      ),
    ),
  };

  for (const chapter of chapters) {
    const entryName = `data/${buildEntryName(chapter.id)}.json`;
    entries[entryName] = strToU8(JSON.stringify(chapter.content));
  }
  const bib: Record<string, string> = {};
  (await HighTexDB.getInstance().cite.toArray()).forEach((k) => {
    bib[k.key] = k.bib;
  });
  entries["data/reference.json"] = strToU8(JSON.stringify(bib));

  try {
    return zipSync(entries, { level: 9 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new HighTexExportError(`Failed to build HighTex archive: ${message}`);
  }
}

export async function saveHighTexPackage(
  documentId: string,
  suggestedName?: string,
): Promise<{ canceled: boolean; filePath?: string }> {
  const payload = await exportHighTexDocument(documentId);
  const fileName = sanitizeFileName(suggestedName ?? `${documentId}.hightex`);

  const configExport = window.config.get()?.export;

  const result = await window.ipcRenderer.invoke(
    "hightex:export",
    payload,
    fileName,
    {
      showDialog: configExport?.saveDialog ?? false,
      defaultFolder: configExport?.saveFolder,
    },
  );

  return result as { canceled: boolean; filePath?: string };
}
