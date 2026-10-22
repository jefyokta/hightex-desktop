import { HighTexDB } from "@/editor/storage/hightex-db";
import { HighTexExportError } from "@/exception/hightex-export";
import { Schema } from "./schema";
import { zipSync } from "fflate";
import { isStaticVar } from "../is-static-var";
import { t } from "@/utils/lang";
import { writeProfileEntries } from "./profile";
import { contentAssets } from "../content-assets";
import { applyCloudAcademic } from "../cloud-academic";

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

  async export(): Promise<{ canceled: boolean; filePath?: string }> {
    const { buffer } = await this.buildExport();

    const document = await this.db.documents.get(this.documentId);
    if (!document) {
      throw new HighTexExportError(
        t("error.htx.document_not_found_for_export"),
      );
    }

    const configExport = window.config.get()?.export;
    const fileName = `${document.title.replace(/[^a-zA-Z0-9-_. ]/g, "-")}.${this.options.ext}`;

    return await window.ipcRenderer.invoke("hightex:export", buffer, fileName, {
      showDialog: configExport?.saveDialog ?? false,
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
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new Uint8Array(buffer),
    );
    return {
      file: buffer,
      document,
      hash: Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join(""),
    };
  }

  async buildExport(academic?: CloudAcademicData) {
    const snapshot = await this.db.transaction(
      "r",
      [
        this.db.documents,
        this.db.chapters,
        this.db.cite,
        this.db.aliases,
        this.db.documentVariables,
        this.db.images,
      ],
      async () => {
        const document = await this.db.documents.get(this.documentId);
        if (!document)
          throw new HighTexExportError(
            t("error.htx.document_not_found_for_export"),
          );
        const chapters = await this.db.chapters
          .where("id")
          .startsWith(`${document.id}.`)
          .toArray();
        const assets = contentAssets(chapters);
        return {
          document: academic
            ? applyCloudAcademic(document, academic)
            : document,
          chapters,
          cites: await this.db.cite
            .filter(
              (cite) =>
                !cite.documentId ||
                cite.documentId === document.id ||
                assets.references.has(cite.key),
            )
            .toArray(),
          aliases: await this.db.aliases
            .where("documentId")
            .equals(document.id)
            .toArray(),
          variables: await this.db.documentVariables
            .where("documentId")
            .equals(document.id)
            .filter((x) => !isStaticVar(x.name))
            .toArray(),
          images: await this.db.images
            .filter(
              (image) =>
                image.documentId === document.id || assets.images.has(image.id),
            )
            .toArray(),
        };
      },
    );
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
