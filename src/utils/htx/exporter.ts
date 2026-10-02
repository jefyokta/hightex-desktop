import { HighTexDB } from "@/editor/storage/hightex-db";
import { HighTexExportError } from "@/exception/hightex-export";
import { Schema } from "./schema";
import { CategoryEmpty } from "@/exception/categories-empty";
import { staticChapter } from "./schema/static";
import { JSONContent } from "@tiptap/core";
import { zipSync } from "fflate";
import { isStaticVar } from "../is-static-var";
import { t } from "@/utils/lang";

/**
 * export to ht | htx | hightex file
 */
export class Exporter {
  private db = HighTexDB.getInstance();
  private scheme: Schema<2>;

  constructor(
    private documentId: string,
    private options: ExportOptions = {
      format: "json",
      ext: "hightex",
    },
  ) {
    this.scheme = new Schema(2);
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
    const fileName = `${document.title.replace(/[^a-zA-Z0-9-_\. ]/g, "-")}.${this.options.ext}`;

    return await window.ipcRenderer.invoke(
      "hightex:export",
      buffer,
      fileName,
      {
        showDialog: configExport?.saveDialog ?? false,
        defaultFolder: configExport?.saveFolder,
      },
    );
  }

  /**
   * Build a HighTex archive for cloud push.
   *
   * Images are included in the archive but excluded from the content hash.
   */
  async exportForPush(): Promise<{
    file: Uint8Array;
    hash: string;
  }> {
    const { buffer, entries } = await this.buildExport();

    return {
      file: buffer,
      hash: await this.getContentHash(entries),
    };
  }

  private async buildExport(): Promise<{
    buffer: Uint8Array;
    entries: ReturnType<Schema<2>["writter"]["getEntries"]>;
  }> {
    const document = await this.db.documents.get(this.documentId);

    if (!document) {
      throw new HighTexExportError(
        t("error.htx.document_not_found_for_export"),
      );
    }

    this.scheme.writter.setContentFormat(this.options.format);

    const manifest = this.scheme.createManifest(
      document,
      this.options.format,
    );

    this.scheme.writter.putManifest(manifest);

    const cites = await this.db.cite.toArray();

    const chaptersContent = await this.getChaptersContent(
      document.id,
      document.category,
    );

    const aliases = await this.db.aliases
      .where("documentId")
      .equals(document.id)
      .toArray();

    this.scheme.writter.putConfig(document.config);
    this.scheme.writter.putReference(cites);
    this.scheme.writter.putAliases(aliases);

    const vars = await this.db.variables
      .where("documentId")
      .equals(document.id)
      .filter((x) => !isStaticVar(x.name))
      .toArray();

    this.scheme.writter.putVariables(
      vars.map((x) => ({
        name: x.name,
        value: x.value,
      })),
    );

    for (const { chapter, content } of chaptersContent) {
      this.scheme.writter.putChapter(chapter, content);
    }

    const images = await this.db.images
      .where("documentId")
      .equals(this.documentId)
      .toArray();

    for (const image of images) {
      await this.scheme.writter.putImage(image.id, image.blob);
    }

    const entries = this.scheme.writter.getEntries();

    return {
      entries,
      buffer: zipSync(entries, { level: 9 }),
    };
  }

  private async getContentHash(
    entries: ReturnType<Schema<2>["writter"]["getEntries"]>,
  ): Promise<string> {
    const encoder = new TextEncoder();

    const jsonEntries = Object.entries(entries)
      .filter(
        ([name]) =>
          name.endsWith(".json") &&
          !name.endsWith("meta/export.json"),
      )
      .sort(([a], [b]) => a.localeCompare(b));

    const parts = jsonEntries.flatMap(([name, data]) => [
      encoder.encode(name),
      new Uint8Array([0]),
      data,
      new Uint8Array([0]),
    ]);

    const totalLength = parts.reduce(
      (total, part) => total + part.length,
      0,
    );

    const input = new Uint8Array(totalLength);

    let offset = 0;

    for (const part of parts) {
      input.set(part, offset);
      offset += part.length;
    }

    const digest = await crypto.subtle.digest("SHA-256", input);

    return Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
  }

  private async getChapterByCategory(categoryId: string) {
    const storedCategory = await window.hightex.categories();

    const category =
      storedCategory.find((c) => c.id.toString() == categoryId) ||
      storedCategory[0];

    if (!category) {
      throw new CategoryEmpty();
    }

    const dynamic = category.chapters.map((c) => c.chapter);

    if (category.min) {
      return dynamic;
    }

    return [...staticChapter, ...dynamic];
  }

  private async getChaptersContent(docId: string, categoryId: string) {
    const chapters = await this.getChapterByCategory(categoryId);

    const tmp: {
      chapter: string;
      content: JSONContent[];
    }[] = [];

    for (const chapter of chapters) {
      const content = (
        await this.db.chapters.get(`${docId}.${chapter}`)
      )?.content;

      if (content) {
        tmp.push({
          chapter,
          content,
        });
      }
    }

    return tmp;
  }

  *exportLazy() {
    yield 1;
    return "";
  }
}