import { CiteUtils } from "bibtex.js";
import { HighTexDB } from "./hightex-db";
import { contentAssets } from "@/utils/content-assets";
import { isCitationValid, parseBibtexInput } from "@/utils/citation";
import { bibliographyWithAuthors, type CitationAuthor } from "@/utils/citation-authors";
import { t } from "@/utils/lang";

export interface ReferenceUsage {
  documentId: string;
  title: string;
  chapters: string[];
}

export interface ReferenceImportResult {
  records: CiteRecord[];
  skipped: number;
  errors: string[];
}

export interface ReferenceImportOptions {
  reuseEquivalent?: boolean;
}

function metadataSignature(citation: CiteUtils) {
  const { id: _, "citation-key": __, _graph: ___, ...metadata } = citation.getCite();
  return JSON.stringify(metadata, (_key, value) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)));
    }
    return value;
  });
}

/** Workspace reference persistence; UI and editor pickers share the same import/delete rules. */
export class ReferenceRepository {
  constructor(private readonly db = HighTexDB.getInstance()) {}

  all() {
    return this.db.getCites();
  }

  async get(keys: readonly string[]): Promise<CiteRecord[]> {
    return (await this.db.cite.bulkGet([...keys])).filter((record): record is CiteRecord => record !== undefined);
  }

  async importBibtex(
    content: string,
    { reuseEquivalent = false }: ReferenceImportOptions = {},
  ): Promise<ReferenceImportResult> {
    if (!content.trim()) return { records: [], skipped: 0, errors: [t("citation.error.no_bibtex_content")] };
    const parsed = parseBibtexInput(content);
    if (parsed.errors.length) return { records: [], skipped: 0, errors: parsed.errors };
    const entries = parsed.entries.filter(entry => isCitationValid(entry.cite));
    const skipped = parsed.entries.length - entries.length;
    if (!entries.length) return { records: [], skipped, errors: [t("citation.error.no_valid_citations")] };

    return this.db.transaction("rw", this.db.cite, async () => {
      const stored = await this.db.cite.toArray();
      const keys = new Set(stored.map(record => record.key));
      const signatures = new Map<string, CiteRecord>();
      if (reuseEquivalent) {
        for (const record of stored) {
          try {
            signatures.set(metadataSignature(new CiteUtils(record.bib)), record);
          } catch {
            // An unreadable record stays intact and cannot establish equivalence.
          }
        }
      }
      const records: CiteRecord[] = [];
      const additions: CiteRecord[] = [];
      for (const entry of entries) {
        const signature = reuseEquivalent ? metadataSignature(entry.cite) : undefined;
        const existing = signature ? signatures.get(signature) : undefined;
        if (existing) {
          records.push(existing);
          continue;
        }
        let key = entry.key;
        for (let suffix = 1; keys.has(key); suffix++) key = `${entry.key}_${suffix}`;
        keys.add(key);
        const record = { key, bib: entry.bib };
        records.push(record);
        additions.push(record);
        if (signature) signatures.set(signature, record);
      }
      await this.db.cite.bulkPut(additions);
      return { records, skipped, errors: [] };
    });
  }

  async updateAuthors(citation: CiteUtils, authors: CitationAuthor[]) {
    await this.db.cite.update(citation.getId(), { bib: bibliographyWithAuthors(citation, authors) });
  }

  /** Flush current chapter buffers without committing settings or exporting archives. */
  private async flushEditors() {
    const editor = typeof window === "undefined" ? undefined : window.editor;
    if (!editor) return;
    const ids = await this.db.documents.toCollection().primaryKeys();
    await Promise.all(ids.map(async id => {
      if (await editor.has(id)) await editor.flush(id);
    }));
  }

  async usage(key: string): Promise<ReferenceUsage[]> {
    await this.flushEditors();
    return this.db.transaction("r", this.db.documents, this.db.chapters, async () => {
      const chapters = await this.db.chapters.toArray();
      const documents = new Map((await this.db.documents.toArray()).map(document => [document.id, document]));
      const used = new Map<string, ReferenceUsage>();
      for (const chapter of chapters) {
        if (!contentAssets([chapter]).references.has(key)) continue;
        const separator = chapter.id.indexOf(".");
        const id = separator < 0 ? chapter.id : chapter.id.slice(0, separator);
        const usage = used.get(id) ?? { documentId: id, title: documents.get(id)?.title || id, chapters: [] };
        usage.chapters.push(chapter.id.slice(id.length + 1));
        used.set(id, usage);
      }
      return [...used.values()];
    });
  }

  private async findUnused() {
    const [citations, chapters] = await Promise.all([this.db.cite.toArray(), this.db.chapters.toArray()]);
    const used = contentAssets(chapters).references;
    return citations.filter(citation => !used.has(citation.key));
  }

  async unused() {
    await this.flushEditors();
    return this.db.transaction("r", this.db.cite, this.db.chapters, () => this.findUnused());
  }

  /** Recheck within the write transaction; protect usage added after the confirmation. */
  async deleteUnused(keys: string[]): Promise<number> {
    await this.flushEditors();
    const candidates = new Set(keys);
    return this.db.transaction("rw", this.db.cite, this.db.chapters, async () => {
      const unused = await this.findUnused();
      const removable = unused.filter(citation => candidates.has(citation.key)).map(citation => citation.key);
      await this.db.cite.bulkDelete(removable);
      return removable.length;
    });
  }
}
