import { strFromU8 } from "fflate";
import { Reader } from "./reader";
import { JSONContent } from "@tiptap/core";

/**
 * reader for legacy file
 */
export class V1Reader extends Reader<HighTexManifest> {
  async read<T = any>(fileName: string): Promise<T> {
    const entries = await this.entries();
    const str = strFromU8(entries[fileName]);
    try {
      return JSON.parse(str);
    } catch (error) {
      return str as T;
    }
  }

  async getContents() {
    const chapterFile = this.manifest.structure?.chapters || [];
    let content: Record<string, JSONContent[]> = {};
    for (const chapter of chapterFile) {
      const c = await this.read<JSONContent[]>(chapter.file);
      content[chapter.id] = c;
    }
  }
}
