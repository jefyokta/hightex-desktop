import { HighTexDB } from "@/editor/storage/hightex-db";
import { HighTexExportError } from "@/exception/hightex-export";
import { Schema } from "./schema";
import { CategoryEmpty } from "@/exception/categories-empty";
import { staticChapter } from "./schema/static";
import { JSONContent } from "@tiptap/core";
import { zipSync } from "fflate";
import { isStaticVar } from "../is-static-var";

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
    const document = await this.db.documents.get(this.documentId);
    if (!document) {
      throw new HighTexExportError("Document not found for export.");
    }
    this.scheme.writter.setContentFormat(this.options.format);
    const manifest = this.scheme.createManifest(document, this.options.format);
    this.scheme.writter.putManifest(manifest);
    const cites = await this.db.cite.toArray();

    const chaptersContent = await this.getChaptersContent(
      document.id,
      document.category,
    );
    this.scheme.writter.putConfig(document.config);
    this.scheme.writter.putReference(cites);
    const vars = await this.db.variables
      .where("documentId")
      .equals(document.id)
      .filter((x) => !isStaticVar(x.name))
      .toArray();
    this.scheme.writter.putVariables(
      vars.map((x) => ({ name: x.name, value: x.value })),
    );
    for (const { chapter, content } of chaptersContent) {
      this.scheme.writter.putChapter(chapter, content);
    }
    const images = await this.db.images
      .where("documentId")
      .equals(document.id)
      .toArray();

    for (const image of images) {
      await this.scheme.writter.putImage(image.id, image.blob);
    }

    const buffer = zipSync(this.scheme.writter.getEntries(), { level: 9 });
    const configExport = window.config.get()?.export;
    const fileName = `${document.title.replace(/[^a-zA-Z0-9-_\. ]/g, "-")}.${this.options.ext}`;

    return await window.ipcRenderer.invoke("hightex:export", buffer, fileName, {
      showDialog: configExport?.saveDialog ?? false,
      defaultFolder: configExport?.saveFolder,
    });
  }

  private async getChapterByCategory(categoryId: string) {
    const storedCategory = await window.hightex.categories();

    const category =
      storedCategory.find((c) => c.id.toString() == categoryId) ||
      storedCategory[0];
    if (!category) throw new CategoryEmpty();
    const dynamic = category.chapters.map((c) => c.chapter);
    if (category.min) return dynamic;
    return [...staticChapter, ...dynamic];
  }

  private async getChaptersContent(docId: string, categoryId: string) {
    const chapters = await this.getChapterByCategory(categoryId);
    const tmp: { chapter: string; content: JSONContent[] }[] = [];
    for (const chapter of chapters) {
      const content = (await this.db.chapters.get(`${docId}.${chapter}`))
        ?.content;
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
