import type { DocumentNode, ImportedHighTexV2 } from "@hightex/importer";
import { Exporter } from "@/utils/htx/exporter";
import { readImportModel } from "@/utils/htx/import-model";
import { HighTexDB } from "./hightex-db";

export type CompareStatus = "added" | "removed" | "modified";

export type DocumentCompareEntry = {
  key: string;
  status: CompareStatus;
  before?: string;
  after?: string;
  beforeText?: string;
  afterText?: string;
  textUnchanged?: boolean;
};

export type DocumentCompareSection = {
  key: string;
  entries: DocumentCompareEntry[];
};

export type DocumentComparison = {
  main: HighTexDocument;
  branch: HighTexDocument;
  sections: DocumentCompareSection[];
  summary: Record<CompareStatus, number>;
};

const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonical(item)]),
    );
  return value;
};

const serialized = (value: unknown) => JSON.stringify(canonical(value));
const display = (value: unknown) =>
  typeof value === "string" ? value : JSON.stringify(canonical(value), null, 2);

const flatten = (
  value: unknown,
  prefix = "",
  result = new Map<string, unknown>(),
) => {
  if (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length
  ) {
    for (const [key, child] of Object.entries(value))
      flatten(child, prefix ? `${prefix}.${key}` : key, result);
  } else if (prefix) result.set(prefix, value);
  return result;
};

const compareMaps = (
  main: Map<string, unknown>,
  branch: Map<string, unknown>,
): DocumentCompareEntry[] =>
  [...new Set([...main.keys(), ...branch.keys()])]
    .sort((a, b) => a.localeCompare(b, "id", { numeric: true }))
    .flatMap((key) => {
      const hasMain = main.has(key);
      const hasBranch = branch.has(key);
      const before = main.get(key);
      const after = branch.get(key);
      if (hasMain && hasBranch && serialized(before) === serialized(after))
        return [];
      return [
        {
          key,
          status: !hasMain
            ? ("added" as const)
            : !hasBranch
              ? ("removed" as const)
              : ("modified" as const),
          before: hasMain ? display(before) : undefined,
          after: hasBranch ? display(after) : undefined,
        },
      ];
    });

const digest = async (bytes: Uint8Array) => {
  const input = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(input).set(bytes);
  const result = await crypto.subtle.digest("SHA-256", input);
  return Array.from(new Uint8Array(result), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
};

const bibIdentity = (key: string, bib: string) => {
  const match = bib.match(/@\s*[\w-]+\s*\{\s*([^,\s]+)\s*,/);
  return match?.[1]?.trim() || key;
};

const normalizeBib = (bib: string) =>
  bib
    .replace(/@\s*([\w-]+)\s*\{\s*([^,\s]+)\s*,/, "@$1{<key>,")
    .replace(/\s+/g, " ")
    .trim();

const referenceMaps = (model: ImportedHighTexV2) => {
  const keyToIdentity = new Map<string, string>();
  const records = new Map<string, unknown>();
  for (const [key, bib] of Object.entries(model.references)) {
    const identity = bibIdentity(key, bib);
    keyToIdentity.set(key, identity);
    records.set(identity, normalizeBib(bib));
  }
  return { keyToIdentity, records };
};

const normalizeNode = (
  node: DocumentNode,
  images: Map<string, string>,
  references: Map<string, string>,
): DocumentNode => {
  const attrs = node.attrs ? { ...node.attrs } : undefined;
  if (attrs && node.type === "image" && typeof attrs.src === "string")
    attrs.src = images.get(attrs.src) ?? attrs.src;
  if (attrs && node.type === "cite" && typeof attrs.cite === "string")
    attrs.cite = attrs.cite
      .split("|")
      .map((key) => references.get(key) ?? key)
      .join("|");
  return {
    ...node,
    ...(attrs ? { attrs } : {}),
    ...(node.content
      ? {
          content: node.content.map((child) =>
            normalizeNode(child, images, references),
          ),
        }
      : {}),
  };
};

const textOf = (nodes: DocumentNode[]): string =>
  nodes
    .map((node) => {
      if (node.type === "text") return node.text ?? "";
      if (node.type === "hardBreak") return "\n";
      const text = textOf(node.content ?? []);
      return ["paragraph", "heading", "listItem", "tableRow"].includes(
        node.type,
      )
        ? `${text}\n`
        : text;
    })
    .join("")
    .trim();

const imageIdentities = async (model: ImportedHighTexV2) => {
  const identities = new Map<string, string>();
  const records = new Map<string, unknown>();
  for (const [id, image] of Object.entries(model.images)) {
    const hash = await digest(image.bytes);
    identities.set(id, hash);
    records.set(hash, { mime: image.mime, bytes: image.bytes.byteLength });
  }
  return { identities, records };
};

const chapterDiff = (
  main: ImportedHighTexV2,
  branch: ImportedHighTexV2,
  mainImages: Map<string, string>,
  branchImages: Map<string, string>,
  mainReferences: Map<string, string>,
  branchReferences: Map<string, string>,
): DocumentCompareEntry[] => {
  const mainChapters = new Map(
    main.chapters.map((chapter) => [chapter.id, chapter]),
  );
  const branchChapters = new Map(
    branch.chapters.map((chapter) => [chapter.id, chapter]),
  );
  return [...new Set([...mainChapters.keys(), ...branchChapters.keys()])]
    .sort((a, b) => a.localeCompare(b, "id", { numeric: true }))
    .flatMap((key) => {
      const before = mainChapters.get(key);
      const after = branchChapters.get(key);
      const beforeContent = (before?.content ?? []).map((node) =>
        normalizeNode(node, mainImages, mainReferences),
      );
      const afterContent = (after?.content ?? []).map((node) =>
        normalizeNode(node, branchImages, branchReferences),
      );
      if (
        before &&
        after &&
        serialized(beforeContent) === serialized(afterContent)
      )
        return [];
      const beforeText = textOf(before?.content ?? []);
      const afterText = textOf(after?.content ?? []);
      return [
        {
          key,
          status: !before
            ? ("added" as const)
            : !after
              ? ("removed" as const)
              : ("modified" as const),
          before: before ? tStringify(beforeContent) : undefined,
          after: after ? tStringify(afterContent) : undefined,
          beforeText,
          afterText,
          textUnchanged: !!before && !!after && beforeText === afterText,
        },
      ];
    });
};

const tStringify = (value: unknown) =>
  JSON.stringify(canonical(value), null, 2);

export async function compareDocumentBranch(
  branchId: string,
): Promise<DocumentComparison> {
  const db = HighTexDB.getInstance();
  const branch = await db.documents.get(branchId);
  if (!branch?.parentId) throw new Error("Document is not a branch");
  const main = await db.documents.get(branch.parentId);
  if (!main) throw new Error("Main document is unavailable");

  const [mainArchive, branchArchive] = await Promise.all([
    new Exporter(main.id).buildExport(),
    new Exporter(branch.id).buildExport(),
  ]);
  const mainModel = readImportModel(mainArchive.buffer);
  const branchModel = readImportModel(branchArchive.buffer);
  const [mainImages, branchImages, mainReferences, branchReferences] =
    await Promise.all([
      imageIdentities(mainModel),
      imageIdentities(branchModel),
      Promise.resolve(referenceMaps(mainModel)),
      Promise.resolve(referenceMaps(branchModel)),
    ]);

  const sections: DocumentCompareSection[] = [
    {
      key: "document",
      entries: compareMaps(
        flatten({
          title: mainModel.document.title,
          altTitle: mainModel.document.altTitle,
          category: mainModel.document.category,
          keywords: mainModel.document.keywords,
        }),
        flatten({
          title: branchModel.document.title,
          altTitle: branchModel.document.altTitle,
          category: branchModel.document.category,
          keywords: branchModel.document.keywords,
        }),
      ),
    },
    {
      key: "config",
      entries: compareMaps(
        flatten(mainModel.config),
        flatten(branchModel.config),
      ),
    },
    {
      key: "profile",
      entries: compareMaps(
        flatten(mainModel.profile ?? {}),
        flatten(branchModel.profile ?? {}),
      ),
    },
    {
      key: "chapters",
      entries: chapterDiff(
        mainModel,
        branchModel,
        mainImages.identities,
        branchImages.identities,
        mainReferences.keyToIdentity,
        branchReferences.keyToIdentity,
      ),
    },
    {
      key: "images",
      entries: compareMaps(mainImages.records, branchImages.records),
    },
    {
      key: "profilePicture",
      entries: compareMaps(
        new Map(
          mainModel.profilePicture
            ? [
                [
                  "profile picture",
                  await digest(mainModel.profilePicture.bytes),
                ],
              ]
            : [],
        ),
        new Map(
          branchModel.profilePicture
            ? [
                [
                  "profile picture",
                  await digest(branchModel.profilePicture.bytes),
                ],
              ]
            : [],
        ),
      ),
    },
    {
      key: "variables",
      entries: compareMaps(
        new Map(mainModel.variables.map(({ name, value }) => [name, value])),
        new Map(branchModel.variables.map(({ name, value }) => [name, value])),
      ),
    },
    {
      key: "aliases",
      entries: compareMaps(
        new Map(mainModel.aliases.map(({ key, value }) => [key, value])),
        new Map(branchModel.aliases.map(({ key, value }) => [key, value])),
      ),
    },
    {
      key: "references",
      entries: compareMaps(mainReferences.records, branchReferences.records),
    },
  ].filter((section) => section.entries.length > 0);

  const summary: Record<CompareStatus, number> = {
    added: 0,
    removed: 0,
    modified: 0,
  };
  sections.forEach((section) =>
    section.entries.forEach((entry) => summary[entry.status]++),
  );
  return { main, branch, sections, summary };
}
