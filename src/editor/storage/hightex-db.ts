import { CloudError } from "@/exception/cloud-error";
import { defaulBib } from "@/data/default-bib";
import Dexie, { Table } from "dexie";
import { Manager } from "../manager";
import { CiteUtils } from "bibtex.js";
import { Symbols } from "@/utils/symbol";
import { ActionCanceled } from "@/exception/action-canceled";
import { ShouldNotified } from "@/exception/interfaces/should-notified";
import {
  emptyAuthorProfile,
  getAuthorDetails,
  getProfileVariables,
  isProfileVariable,
} from "@/utils/document-profile";
import {
  withCloudAcademicSource,
  preserveCloudAcademic,
} from "@/utils/cloud-academic";

export class HighTexDB extends Dexie {
  documents!: Table<HighTexDocument, string>;
  chapters!: Table<HighTexChapter, string>;
  cite!: Table<CiteRecord, string>;
  chapterGraphs!: Table<ChapterGraph, string>;
  images!: Table<ImageRecord, string>;
  documentVariables!: Table<Variable, [string, string]>;
  aliases!: Table<Alias, string>;

  private static instance?: HighTexDB;

  constructor(name = "HighTexDB") {
    super(name);

    this.version(1).stores({
      documents: "id",
      chapters: "id",
      cite: "key, documentId",
      chapterGraphs: "id",
      images: "id, documentId",
      variables: "name, documentId",
      //key = {documentId}.{key}
      aliases: "key, documentId",
      file: "filePath, documentId",
    });
    // Keep the old table as a backup; its primary key cannot hold two scopes.
    this.version(2)
      .stores({
        documentVariables: "[documentId+name], documentId, name",
      })
      .upgrade(async (transaction) => {
        const variables = await transaction.table("variables").toArray();
        await transaction.table("documentVariables").bulkPut(variables);
      });
    this.on("populate", (transaction) => {
      return transaction.table("cite").bulkPut(defaulBib);
    });
  }
  async warm() {
    await this.cite.bulkPut(defaulBib);
  }

  static getInstance() {
    if (!this.instance) {
      this.instance = new HighTexDB();
    }
    return this.instance;
  }

  static async getDocuments() {
    return await this.getInstance().documents.toArray();
  }
  deleteVar(name: string, docId: string) {
    return this.documentVariables
      .where("name")
      .equals(name)
      .and((v) => v.documentId == docId)
      .delete();
  }

  async updateDocument(
    document: HighTexDocument,
    authorDetails?: Omit<Profile, "cv">,
  ) {
    const updated = await this.transaction("rw", this.documents, async () => {
      const current = await this.documents.get(document.id);
      const profile = current ? current.profile : document.profile;
      const next = preserveCloudAcademic(current, {
        ...document,
        // Metadata changes must not overwrite a profile edited elsewhere.
        profile: authorDetails
          ? {
              ...emptyAuthorProfile(),
              ...profile,
              ...getAuthorDetails(authorDetails),
            }
          : profile,
        updatedAt: new Date(),
      });
      await this.documents.put(next);
      return next;
    });
    Manager.app.dispatch("document:updated", { document: updated });
    return updated;
  }

  async updateProfile(documentId: string, patch: Partial<AuthorProfile>) {
    const updated = await this.transaction("rw", this.documents, async () => {
      const document = await this.documents.get(documentId);
      if (!document) throw new Error("Document not found");

      const next = preserveCloudAcademic(document, {
        ...document,
        profile: { ...emptyAuthorProfile(), ...document.profile, ...patch },
        updatedAt: new Date(),
      });
      await this.documents.put(next);
      return next;
    });
    Manager.app.dispatch("document:updated", { document: updated });
    return updated;
  }
  async cacheCloudAcademic(documentId: string, data: CloudAcademicData) {
    if (!data.serverDocumentId) throw new CloudError("cloud_changed");
    const updated = await this.transaction("rw", this.documents, async () => {
      const document = await this.documents.get(documentId);
      if (!document) throw new Error("Document not found");
      const source = document.cloudAcademic;
      if (
        source &&
        (source.accountId !== data.session.accountId ||
          source.serverUrl !== data.session.serverUrl ||
          source.serverDocumentId !== data.serverDocumentId)
      )
        throw new CloudError("academic_scope");
      const next = withCloudAcademicSource(document, data);
      await this.documents.put(next);
      return next;
    });
    Manager.app.dispatch("document:updated", { document: updated });
    return updated;
  }

  async deleteDocument(documentId: string) {
    if ("editor" in window) {
      const windowOpened = await window.editor.has(documentId);
      if (windowOpened) {
        throw new ShouldNotified({
          message: "Cannot delete document while it is being edited",
          description: "Please close the editor before deleting this document.",
        });
      }
    }
    await this.documents.delete(documentId);

    const chapters = await this.chapters
      .where("id")
      .startsWith(documentId)
      .toArray();

    const chapterIds = chapters.map((c) => c.id);
    await this.images.where("documentId").equals(documentId).delete();
    await this.documentVariables
      .where("documentId")
      .equals(documentId)
      .delete();
    await Promise.all([
      this.chapters.bulkDelete(chapterIds),
      this.deleteChapterGraphs(chapterIds),
    ]);
    return true;
  }
  async saveImage(blob: Blob, documentId: string): Promise<string> {
    const hashBuffer = await crypto.subtle.digest(
      "SHA-256",
      await blob.arrayBuffer(),
    );
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const id = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    const record: ImageRecord = { id, blob, documentId, createdAt: Date.now() };
    await this.images.put(record);
    return id;
  }
  async getBlobUrl(id: string): Promise<string | null> {
    const record = await this.images.get(id);
    if (record === undefined) return null;
    return URL.createObjectURL(record.blob);
  }

  async getBlob(id: string): Promise<Blob | null> {
    const record = await this.images.get(id);
    return record?.blob ?? null;
  }

  async deleteImageById(id: string): Promise<void> {
    await this.images.delete(id);
  }
  private async deleteChapterGraphs(chapterIds: string[]) {
    const graphs = await this.chapterGraphs.bulkGet(chapterIds);

    const validGraphs = graphs.filter((g) => g !== undefined);

    await Promise.all(validGraphs.map((g) => this.chapterGraphs.delete(g.id)));
  }

  async getCites() {
    return (await this.cite.toArray()).map((c) => {
      return new CiteUtils(c.bib).setId(c.key);
    });
  }

  async getVars(documentId: string) {
    const [global, local] = await Promise.all([
      this.getGlobalVars(),
      this.getVarsOnlyOn(documentId),
    ]);
    return Array.from(
      new Map(
        [...global, ...local].map((variable) => [variable.name, variable]),
      ).values(),
    );
  }
  async getVarsOnlyOn(documentId: string) {
    const [variables, document] = await Promise.all([
      this.documentVariables.where("documentId").equals(documentId).toArray(),
      this.documents.get(documentId),
    ]);
    return [
      ...variables.filter((variable) => !isProfileVariable(variable.name)),
      ...Object.entries(getProfileVariables(document?.profile)).map(
        ([name, value]) => ({
          documentId,
          name,
          value,
        }),
      ),
    ];
  }

  async getVar(name: string, documentId = "global") {
    if (isProfileVariable(name)) {
      const document = await this.documents.get(documentId);
      const values = getProfileVariables(document?.profile);
      return name === "cv"
        ? (document?.profile?.cv ?? "")
        : (values[name as keyof typeof values] ?? "");
    }
    const local = await this.documentVariables.get([documentId, name]);
    const global =
      local ?? (await this.documentVariables.get(["global", name]));
    return global?.value;
  }

  async getGlobalVars() {
    return this.documentVariables
      .where("documentId")
      .equals("global")
      .filter((variable) => !isProfileVariable(variable.name))
      .toArray();
  }
  async setVar(
    name: string,
    value: string,
    documentId = "global",
  ): Promise<void> {
    if (Symbols.find((s) => s[0] === name)) {
      throw new ActionCanceled(
        `cannot create var with name '${name}', because its belongs to a symbol`,
      );
    }
    await this.documentVariables.put({
      name,
      value,
      documentId,
    });
  }

  async getAliases(documentId: string) {
    return (
      await this.aliases.where("documentId").equals(documentId).toArray()
    ).map((e) => {
      const prefix = `${e.documentId}.`;
      return {
        key: e.key.slice(prefix.length),
        value: e.value,
      };
    });
  }

  async setAlias(key: string, value: string, documentId: string) {
    await this.aliases.put({ key: `${documentId}.${key}`, value, documentId });
  }
}
