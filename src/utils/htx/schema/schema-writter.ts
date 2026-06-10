import { JSONContent } from "@tiptap/core";
import { strToU8 } from "fflate";

/**
 *
 * Scheme v2 writter
 */
export class SchemaWritter {
  private imagePath: string = "files/assets/images";
  private chapterPath = "files/chapters";
  private contentFormat: ContentFormat = "json";

  private entries: Record<string, Uint8Array<ArrayBufferLike>> = {};
  constructor() {
    this.entries["meta/export.json"] = this.jsonToU8({
      exported_by: "HighTex Engine",
      timestamp: new Date().toISOString(),
    });
  }
  setContentFormat(format: ContentFormat) {
    this.contentFormat = format;
  }
  async putImage(id: string, blob: Blob) {
    const name = `${this.imagePath}/${id}.webp`;
    this.entries[name] = new Uint8Array(await blob.arrayBuffer());
  }

  putChapter(id: string, content: JSONContent[]) {
    this.entries[`${this.chapterPath}/${id}.${this.contentFormat}`] =
      this.contentResolver(content);
  }
  putManifest(manifest: HighTexManifestV2) {
    this.entries["manifest.json"] = this.jsonToU8(manifest);
  }

  putConfig(conf: HighTexDocument["config"]) {
    this.entries["files/config.json"] = this.jsonToU8(conf);
  }
  putReference(cites: CiteRecord[]) {
    const tmp: Record<string, string> = {};
    cites.forEach((c) => {
      tmp[c.key] = c.bib;
    });
    this.entries["files/assets/references.json"] = this.jsonToU8(tmp);
  }

  private jsonToU8(json: any) {
    return strToU8(JSON.stringify(json));
  }

  private contentResolver(json: JSONContent[]) {
    if (this.contentFormat == "ht") {
      return strToU8("@unimplemented");
    }
    return this.jsonToU8(json);
  }

  getEntries() {
    return this.entries;
  }
}
