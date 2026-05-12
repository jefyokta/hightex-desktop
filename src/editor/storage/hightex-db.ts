import Dexie, { Table } from "dexie";

export class HighTexDB extends Dexie {
  documents!: Table<HighTexDocument, string>;
  chapters!: Table<HighTexChapter, string>;
  cite!: Table<CiteRecord, string>;
  chapterGraphs!: Table<ChapterGraph, string>;

  private static instance?: HighTexDB;

  constructor() {
    super("HighTexDB");

    this.version(1).stores({
      documents: "id",
      chapters: "id",
      cite: "key, documentId",
      chapterGraphs: "id",
    });
  }

  static getInstance() {
    if (!this.instance) {
      this.instance = new HighTexDB();
      this.instance.cite.put({
        key: "okta2026pengembangan",
        bib: `@article{okta2026pengembangan,
  author  = {{Jepi Okta Mipa}},
  title   = {Pengembangan Editor Penulisan Tugas Akhir Mahasiswa Program Studi Sistem Informasi Berbasis Web Menggunakan Extreme Programming},
  journal = {Universitas Islam Negeri Sultan Syarif Kasim Riau Repository},
  year    = {2026},
  url     = {https://repository.uin-suska.ac.id/93006/},
  pdf     = {http://repository.uin-suska.ac.id/93006/1/ta-tanpa-hasil%20-%20JEPI%20OKTA%20MIPA%20SISTEM%20INFORMASI.pdf}
}
`,
      });
    }
    return this.instance;
  }

  static async getDocuments() {
    return await this.getInstance().documents.toArray();
  }
}
