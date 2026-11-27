import { useIPC } from "@/hooks/use-ipc";
import { HighTexDB } from "@/editor/storage/hightex-db";
import { HighTexExportError } from "@/exception/hightex-export";
import { Schema } from "./schema";
import { zipSync } from "fflate";
import { t } from "@/utils/lang";
import { writeProfileEntries } from "./profile";
import { contentFingerprint } from "./content-fingerprint";
import { readDocumentSnapshot } from "@/editor/storage/document-snapshot";

/**
 * export to ht | htx | hightex file
 */
export class Exporter {
  private db = HighTexDB.getInstance();
  private scheme: Schema;

  constructor(
    private documentId: string,
    private options: ExportOptions = {
      format: "json",
      ext: "hightex",
    },
  ) {
    this.scheme = new Schema();
  }

  async export(options: { showDialog?: boolean } = {}): Promise<{ canceled: boolean; filePath?: string }> {
    const { buffer } = await this.buildExport();

    const document = await this.db.documents.get(this.documentId);
    if (!document) {
      throw new HighTexExportError(
        t("error.htx.document_not_found_for_export"),
      );
    }

    const configExport = useIPC("config").config.get()?.export;
    const fileName = `${document.title.replace(/[^a-zA-Z0-9-_. ]/g, "-")}.${this.options.ext}`;

    return await useIPC("ipcRenderer").ipcRenderer.invoke("hightex:export", buffer, fileName, {
      showDialog: options.showDialog ?? configExport?.saveDialog ?? false,
      defaultFolder: configExport?.saveFolder,
    });
  }

  /** Freeze metadata, content and assets in one IndexedDB read transaction. */
  async exportForPush(academic?: CloudAcademicData): Promise<{
    file: Uint8Array;
    hash: string;
    document: HighTexDocument;
  }> {
    const { buffer, document } = await this.buildExport(academic);
    return {
      file: buffer,
      document,
      hash: await contentFingerprint(buffer),
    };
  }

  async buildExport(academic?: CloudAcademicData, draft?: HighTexDocument) {
    const snapshot = await readDocumentSnapshot(this.documentId, {
      academic,
      draft,
    });
    const { document } = snapshot;
    // A new writer prevents deleted chapters/images surviving a second export.
    this.scheme = new Schema();
    this.scheme.writter.setContentFormat(this.options.format);
    this.scheme.writter.putManifest(
      this.scheme.createManifest(document, this.options.format),
    );
    this.scheme.writter.putConfig(document.config);
    this.scheme.writter.putReference(snapshot.cites);
    this.scheme.writter.putAliases(snapshot.aliases);
    this.scheme.writter.putVariables(
      snapshot.variables.map(({ name, value }) => ({ name, value })),
    );
    for (const chapter of snapshot.chapters) {
      this.scheme.writter.putChapter(
        chapter.id.slice(document.id.length + 1),
        chapter.content,
      );
    }
    for (const image of snapshot.images)
      await this.scheme.writter.putImage(image.id, image.blob);
    const unordered = {
      ...this.scheme.writter.getEntries(),
      ...(document.profile ? await writeProfileEntries(document.profile) : {}),
    };
    const entries = Object.fromEntries(
      Object.entries(unordered).sort(([a], [b]) => a.localeCompare(b)),
    );
    return {
      document,
      entries,
      buffer: zipSync(entries, { level: 9, mtime: new Date(1980, 0, 1) }),
    };
  }
}
