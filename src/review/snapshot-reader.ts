import { strFromU8, unzipSync } from "fflate";
import type { JSONContent } from "@tiptap/core";
import {
  emptyAuthorProfile,
  getProfileVariables,
  isProfileVariable,
  normalizeAuthorProfile,
} from "@/utils/document-profile";
import { readProfileEntries } from "@/utils/htx/profile";
import { Symbols } from "@/utils/symbol";

export type SnapshotSource =
  | { kind: "local"; filename: string }
  | {
      kind: "submission";
      session: ReviewSession;
      submissionId: string;
      documentId: string;
      sha256: string;
    };
export interface SnapshotChapter {
  id: string;
  content: readonly JSONContent[];
}
export interface SnapshotReadModel {
  source: Readonly<SnapshotSource>;
  sha256: string;
  document: Readonly<HighTexDocument>;
  chapters: readonly SnapshotChapter[];
  references: Readonly<Record<string, string>>;
  images: ReadonlyMap<string, Blob>;
  unsupportedNodes: readonly string[];
  variable(name: string): string;
  originalFile(): Uint8Array;
}

export class SnapshotReadError extends Error {
  constructor(
    readonly code:
      | "invalid_archive"
      | "unsupported_format"
      | "invalid_content"
      | "too_large"
      | "integrity_failed",
  ) {
    super(code);
  }
}

const MAX_ARCHIVE = 64 * 1024 * 1024;
const MAX_CONTENT = 128 * 1024 * 1024;
const supportedNodes = new Set([
  "doc",
  "text",
  "paragraph",
  "heading",
  "hardBreak",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
  "codeBlock",
  "horizontalRule",
  "image",
  "imageFigure",
  "figure",
  "figcaption",
  "figureTable",
  "table",
  "tableRow",
  "tableCell",
  "tableHeader",
  "grid",
  "gridRow",
  "gridCell",
  "mathInline",
  "blockMath",
  "cite",
  "variable",
  "refComponent",
  "ref",
  "dots",
]);
const supportedMarks = new Set([
  "bold",
  "italic",
  "underline",
  "strike",
  "code",
  "subscript",
  "superscript",
  "note",
  "link",
]);
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new SnapshotReadError("invalid_content");
  return value as Record<string, unknown>;
};
const dictionary = (value: unknown) =>
  Array.isArray(value) && value.length === 0 ? {} : object(value);
const string = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback;
const keywordList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

const freeze = <T>(value: T): T => {
  if (value && typeof value === "object" && !(value instanceof Blob)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

export const readSnapshot = async (
  input: Uint8Array,
  source: SnapshotSource,
): Promise<SnapshotReadModel> => {
  if (!input.length) throw new SnapshotReadError("invalid_archive");
  if (input.length > MAX_ARCHIVE) throw new SnapshotReadError("too_large");
  source =
    source.kind === "submission"
      ? { ...source, session: { ...source.session } }
      : { ...source };
  const bytes = new Uint8Array(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const sha256 = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  if (source.kind === "submission" && source.sha256.toLowerCase() !== sha256)
    throw new SnapshotReadError("integrity_failed");
  let total = 0;
  let files = 0;
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes, {
      filter: (entry) => {
        if (
          entry.name.startsWith("/") ||
          entry.name.includes("\\") ||
          entry.name.split("/").some((part) => part === ".." || part === ".")
        )
          throw new SnapshotReadError("invalid_archive");
        total += entry.originalSize;
        if (total > MAX_CONTENT || ++files > 2000)
          throw new SnapshotReadError("too_large");
        return !entry.name.endsWith("/");
      },
    });
  } catch (error) {
    if (error instanceof SnapshotReadError) throw error;
    throw new SnapshotReadError("invalid_archive");
  }

  let values = 0;
  const validate = (value: unknown, depth = 0) => {
    if (depth > 100 || ++values > 200000)
      throw new SnapshotReadError("too_large");
    if (value && typeof value === "object")
      Object.values(value).forEach((child) => validate(child, depth + 1));
  };
  const json = (path: string): unknown => {
    if (!entries[path]) throw new SnapshotReadError("invalid_content");
    try {
      const value: unknown = JSON.parse(strFromU8(entries[path]));
      validate(value);
      return value;
    } catch (error) {
      if (error instanceof SnapshotReadError) throw error;
      throw new SnapshotReadError("invalid_content");
    }
  };
  if (!entries["manifest.json"]) throw new SnapshotReadError("invalid_archive");
  const manifest = object(json("manifest.json"));
  const web = manifest.format === "hightex" && manifest.schema_version === 1;
  const desktop =
    !web && (manifest.schema_version === 2 || manifest.version === 2);
  if (
    (!web && !desktop) ||
    (desktop &&
      manifest.schema_version !== undefined &&
      manifest.schema_version !== 2) ||
    (desktop && manifest.version !== undefined && manifest.version !== 2)
  )
    throw new SnapshotReadError("unsupported_format");
  if (desktop && manifest.format !== undefined && manifest.format !== "json")
    throw new SnapshotReadError("unsupported_format");
  const metadata =
    manifest.document === undefined && desktop ? {} : object(manifest.document);
  const title = object(metadata.title ?? {});
  const keywords =
    Array.isArray(metadata.keywords) && metadata.keywords.length === 0
      ? {}
      : object(metadata.keywords ?? {});
  let profile: AuthorProfile | undefined;
  try {
    // Validate before reading profile entries to bound nested JSON metadata.
    if (entries["files/profile.json"]) json("files/profile.json");
    profile = readProfileEntries(
      entries,
      manifest.profile as Profile | undefined,
    );
    if (!profile && web && manifest.author) {
      const author = object(manifest.author);
      profile = normalizeAuthorProfile({
        ...emptyAuthorProfile(),
        name: string(author.name),
      });
      if (Array.isArray(author.mentors)) {
        for (const value of author.mentors) {
          const mentor = object(value);
          if (mentor.role === "primary")
            profile!.advisorName = string(mentor.name);
          if (mentor.role === "secondary")
            profile!.secondAdvisor = { name: string(mentor.name), nip: "" };
        }
      }
    }
  } catch (error) {
    if (error instanceof SnapshotReadError) throw error;
    throw new SnapshotReadError("invalid_content");
  }
  const unsupported = new Set<string>();
  const nodes = (value: unknown): JSONContent[] => {
    const contents = Array.isArray(value)
      ? value
      : object(value).type === "doc"
        ? object(value).content
        : [value];
    if (!Array.isArray(contents))
      throw new SnapshotReadError("invalid_content");
    return contents.map((value) => {
      const node = object(value);
      if (typeof node.type !== "string" || !node.type)
        throw new SnapshotReadError("invalid_content");
      if (!supportedNodes.has(node.type)) unsupported.add(node.type);
      if (node.text !== undefined && typeof node.text !== "string")
        throw new SnapshotReadError("invalid_content");
      if (node.attrs !== undefined) object(node.attrs);
      if (
        node.marks !== undefined &&
        (!Array.isArray(node.marks) ||
          node.marks.some((mark) => typeof object(mark).type !== "string"))
      )
        throw new SnapshotReadError("invalid_content");
      if (Array.isArray(node.marks))
        node.marks.forEach((mark) => {
          if (!supportedMarks.has(String(object(mark).type)))
            unsupported.add(`mark:${object(mark).type}`);
        });
      return {
        ...node,
        ...(node.content !== undefined ? { content: nodes(node.content) } : {}),
      } as JSONContent;
    });
  };
  const chapters: SnapshotChapter[] = [];
  if (desktop) {
    for (const path of Object.keys(entries).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true }),
    )) {
      const match = /^files\/chapters\/([^/]+)\.json$/.exec(path);
      if (match) chapters.push({ id: match[1], content: nodes(json(path)) });
    }
  } else {
    const structure = object(manifest.structure);
    if (!Array.isArray(structure.chapters))
      throw new SnapshotReadError("invalid_content");
    for (const value of structure.chapters) {
      const chapter = object(value);
      const chapterId = string(chapter.id);
      if (!chapterId || ["config", "document", "reference"].includes(chapterId))
        continue;
      chapters.push({
        id: chapterId,
        content: nodes(json(string(chapter.file))),
      });
    }
  }
  if (!chapters.length) throw new SnapshotReadError("invalid_content");
  if (new Set(chapters.map((chapter) => chapter.id)).size !== chapters.length)
    throw new SnapshotReadError("invalid_content");
  const references: Record<string, string> = Object.create(null);
  const referencePath = desktop
    ? "files/assets/references.json"
    : "data/reference.json";
  if (entries[referencePath]) {
    for (const [key, value] of Object.entries(
      dictionary(json(referencePath)),
    )) {
      if (typeof value !== "string")
        throw new SnapshotReadError("invalid_content");
      references[key] = value;
    }
  }
  const variables: Record<string, string> = Object.create(null);
  if (entries["files/assets/variables.json"]) {
    const rows = json("files/assets/variables.json");
    if (!Array.isArray(rows)) throw new SnapshotReadError("invalid_content");
    for (const row of rows) {
      const variable = object(row);
      if (
        typeof variable.name !== "string" ||
        typeof variable.value !== "string"
      )
        throw new SnapshotReadError("invalid_content");
      if (!isProfileVariable(variable.name))
        variables[variable.name] = variable.value;
    }
  }
  const images = new Map<string, Blob>();
  for (const [path, value] of Object.entries(entries)) {
    const match = /(?:^|\/)images\/([^/]+)\.(webp|png|jpe?g)$/i.exec(path);
    if (!match) continue;
    const type = `image/${match[2].toLowerCase() === "jpg" ? "jpeg" : match[2].toLowerCase()}`;
    const blob = new Blob([new Uint8Array(value)], { type });
    images.set(match[1], blob);
    images.set(path, blob);
  }
  const configPath = desktop ? "files/config.json" : "data/config.json";
  const category = metadata.category;
  const document: HighTexDocument = {
    id: string(
      metadata.id,
      source.kind === "submission" ? source.documentId : sha256,
    ),
    title: string(desktop ? title.id : title.main),
    altTitle: string(desktop ? title.en : title.alt),
    category:
      typeof category === "string" || typeof category === "number"
        ? String(category)
        : "",
    keywords: {
      indonesian: keywordList(desktop ? keywords.id : keywords.indonesian),
      english: keywordList(desktop ? keywords.en : keywords.english),
    },
    config: entries[configPath] ? dictionary(json(configPath)) : {},
    profile,
  };
  if (!document.id) throw new SnapshotReadError("invalid_content");
  const profileVariables = getProfileVariables(profile);
  const symbols = new Map<string, string>(
    Symbols.map(([name, value]) => [name, value]),
  );
  const frozenSource =
    source.kind === "submission"
      ? { ...source, session: { ...source.session } }
      : { ...source };
  return Object.freeze({
    source: freeze(frozenSource),
    sha256,
    document: freeze(document),
    chapters: freeze(chapters),
    references: freeze(references),
    images,
    unsupportedNodes: freeze([...unsupported]),
    variable: (name: string) => {
      if (name === "title") return document.title;
      if (name === "altTitle") return document.altTitle;
      if (name === "cv") return profile?.cv ?? "";
      if (isProfileVariable(name))
        return profileVariables[name as keyof typeof profileVariables] ?? "";
      return symbols.get(name) ?? variables[name] ?? "";
    },
    originalFile: () => new Uint8Array(bytes),
  });
};
