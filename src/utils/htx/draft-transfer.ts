import { CloudError } from "@/exception/cloud-error";
import type { ImportedHighTexV2 } from "@hightex/importer";
import type { JSONContent } from "@tiptap/core";
import { HighTexDB } from "@/editor/storage/hightex-db";
import { isProfileVariable } from "@/utils/document-profile";
import { contentAssets } from "@/utils/content-assets";
import { toWebPBlob } from "@/utils/images-to-webp";
import Dexie from "dexie";

export interface DraftState {
  document?: HighTexDocument;
  chapters: HighTexChapter[];
  images: ImageRecord[];
  variables: Variable[];
  aliases: Alias[];
  graphs: ChapterGraph[];
}
export interface PreparedDraft {
  state: DraftState & { document: HighTexDocument };
  references: CiteRecord[];
}

const tables = (db: HighTexDB) => [
  db.documents,
  db.chapters,
  db.images,
  db.documentVariables,
  db.aliases,
  db.chapterGraphs,
  db.cite,
];
export const captureDraft = async (
  db: HighTexDB,
  id: string,
): Promise<DraftState> =>
  db.transaction("r", tables(db), async () => ({
    document: await db.documents.get(id),
    chapters: await db.chapters.where("id").startsWith(`${id}.`).toArray(),
    images: await db.images.where("documentId").equals(id).toArray(),
    variables: await db.documentVariables
      .where("documentId")
      .equals(id)
      .toArray(),
    aliases: await db.aliases.where("documentId").equals(id).toArray(),
    graphs: await db.chapterGraphs.where("id").startsWith(`${id}.`).toArray(),
  }));

// Also compare content/assets, since not every legacy write updates updatedAt.
export const draftRevision = async (state: DraftState) => {
  const blobs = new Set<Blob>();
  const collect = (value: unknown) => {
    if (value instanceof Blob) blobs.add(value);
    else if (value && typeof value === "object")
      Object.values(value).forEach(collect);
  };
  collect(state);
  const hashes = new Map(
    await Promise.all(
      [...blobs].map(async (blob) => {
        const digest = await crypto.subtle.digest(
          "SHA-256",
          await blob.arrayBuffer(),
        );
        return [
          blob,
          Array.from(new Uint8Array(digest), (byte) =>
            byte.toString(16).padStart(2, "0"),
          ).join(""),
        ] as const;
      }),
    ),
  );
  return JSON.stringify(state, (_key, value) =>
    value instanceof Blob
      ? {
          blobSize: value.size,
          blobType: value.type,
          sha256: hashes.get(value),
        }
      : value,
  );
};

const date = (value: unknown) => {
  if (!value) return undefined;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};
const chapterName = (id: string) =>
  ({ id: "abstract", en: "abstract-en" })[id] ?? id;

/** Validate everything before opening a write transaction. Never warms an editor. */
export const prepareDraftImport = async (
  model: ImportedHighTexV2,
  id: string,
  categories: Category[],
  prefix: string,
): Promise<PreparedDraft> => {
  const category = categories.find(
    (category) => String(category.id) === model.document.category,
  );
  if (!category) throw new CloudError("unknown_category");
  const images: ImageRecord[] = [];
  const imageKeys = new Map<string, string>();
  const blobs = new Map<Blob, string>();
  const addImage = async (key: string, blob: Blob) => {
    const existing = blobs.get(blob);
    const imageId = existing ?? `${prefix}image${images.length}`;
    imageKeys.set(key, imageId);
    if (!existing) {
      blobs.set(blob, imageId);
      images.push({
        id: imageId,
        blob: blob.type === "image/webp" ? blob : await toWebPBlob(blob),
        documentId: id,
        createdAt: 0,
      });
    }
  };
  for (const [key, asset] of Object.entries(model.images)) {
    const blob = new Blob([new Uint8Array(asset.bytes)], { type: asset.mime });
    await addImage(key, blob);
    imageKeys.set(`files/assets/images/${key}.webp`, imageKeys.get(key)!);
  }
  const inlineImages = async (node: JSONContent): Promise<void> => {
    if (
      node.type === "image" &&
      typeof node.attrs?.src === "string" &&
      node.attrs.src.startsWith("data:")
    ) {
      const source = node.attrs.src;
      if (!imageKeys.has(source)) {
        const match =
          /^data:(image\/(?:webp|png|jpeg));base64,([a-zA-Z0-9+/=\s]+)$/.exec(
            source,
          );
        if (!match) throw new CloudError("invalid_archive");
        await addImage(
          source,
          new Blob(
            [Uint8Array.from(atob(match[2]), (char) => char.charCodeAt(0))],
            { type: match[1] },
          ),
        );
      }
    }
    for (const child of node.content ?? []) await inlineImages(child);
  };
  for (const chapter of model.chapters)
    for (const node of chapter.content) await inlineImages(node);
  const referenceKeys = new Map(
    Object.keys(model.references).map((key, index) => [
      key,
      `${prefix}cite${index}`,
    ]),
  );
  const rewrite = (node: JSONContent): JSONContent => {
    const attrs = node.attrs ? { ...node.attrs } : undefined;
    if (node.type === "image" && attrs && typeof attrs.src === "string") {
      if (/^https?:/i.test(attrs.src) && !imageKeys.has(attrs.src))
        throw new CloudError("external_asset");
      attrs.src = imageKeys.get(attrs.src) ?? `${prefix}missing_image`;
    }
    if (node.type === "cite" && attrs && typeof attrs.cite === "string")
      attrs.cite = attrs.cite
        .split("|")
        .map(
          (key) =>
            referenceKeys.get(key) ??
            `${prefix}missing_cite_${encodeURIComponent(key)}`,
        )
        .join("|");
    return {
      ...node,
      ...(attrs ? { attrs } : {}),
      ...(node.content ? { content: node.content.map(rewrite) } : {}),
    };
  };
  const config = structuredClone(model.config) as HighTexDocument["config"];
  config.consentDate = date(config.consentDate);
  config.validityDate = date(config.validityDate);
  config.statementDate = date(config.statementDate);
  if (config.intern) config.intern.validity = date(config.intern.validity);
  const profile = model.profile
    ? {
        ...model.profile,
        ...(model.profilePicture
          ? {
              picture: new Blob([new Uint8Array(model.profilePicture.bytes)], {
                type: model.profilePicture.mime,
              }),
            }
          : {}),
      }
    : undefined;
  const state: PreparedDraft["state"] = {
    document: {
      ...structuredClone(model.document),
      profile,
      id,
      category: String(category.id),
      config,
      updatedAt: new Date(),
    },
    chapters: model.chapters.map((chapter) => ({
      id: `${id}.${chapterName(chapter.id)}`,
      content: chapter.content.map(rewrite),
    })),
    images,
    variables: model.variables
      .filter((variable) => !isProfileVariable(variable.name))
      .map((variable) => ({ ...variable, documentId: id })),
    aliases: model.aliases.map((alias) => ({
      key: `${id}.${alias.key.startsWith(`${model.document.id}.`) ? alias.key.slice(model.document.id.length + 1) : alias.key}`,
      value: alias.value,
      documentId: id,
    })),
    graphs: [],
  };
  if (
    new Set(state.chapters.map((chapter) => chapter.id)).size !==
    state.chapters.length
  )
    throw new CloudError("invalid_archive");
  return {
    state,
    references: [...referenceKeys].map(([key, mapped]) => ({
      key: mapped,
      bib: model.references[key],
      documentId: id,
    })),
  };
};

const replace = async (db: HighTexDB, id: string, state: DraftState) => {
  const otherChapters = await db.chapters
    .filter((chapter) => !chapter.id.startsWith(`${id}.`))
    .toArray();
  const shared = contentAssets(otherChapters).images;
  // Older drafts can share global image IDs; preserve those bytes for consumers.
  await db.images
    .where("documentId")
    .equals(id)
    .filter((image) => shared.has(image.id))
    .modify({ documentId: "__shared_assets__" });
  await db.chapters.where("id").startsWith(`${id}.`).delete();
  await db.chapterGraphs.where("id").startsWith(`${id}.`).delete();
  await db.images.where("documentId").equals(id).delete();
  await db.documentVariables.where("documentId").equals(id).delete();
  await db.aliases.where("documentId").equals(id).delete();
  if (state.document) await db.documents.put(state.document);
  else await db.documents.delete(id);
  await db.chapters.bulkPut(state.chapters);
  await db.chapterGraphs.bulkPut(state.graphs);
  await db.images.bulkPut(state.images);
  await db.documentVariables.bulkPut(state.variables);
  await db.aliases.bulkPut(state.aliases);
};

export const installDraft = async (
  db: HighTexDB,
  prepared: PreparedDraft,
  before: DraftState,
) => {
  const id = prepared.state.document.id;
  const expected = await draftRevision(before);
  await db.transaction("rw", tables(db), async () => {
    if (
      (await Dexie.waitFor(draftRevision(await captureDraft(db, id)))) !==
      expected
    )
      throw new CloudError("local_changed");
    await replace(db, id, prepared.state);
    await db.cite.bulkPut(prepared.references);
  });
};

/** If acceptance fails, restore only while no newer local edits have occurred. */
export const rollbackDraft = async (
  db: HighTexDB,
  prepared: PreparedDraft,
  before: DraftState,
) => {
  const id = prepared.state.document.id;
  const expected = await draftRevision(prepared.state);
  await db.transaction("rw", tables(db), async () => {
    if (
      (await Dexie.waitFor(draftRevision(await captureDraft(db, id)))) !==
      expected
    )
      throw new CloudError("local_changed");
    await replace(db, id, before);
  });
};
