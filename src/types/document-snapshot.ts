import type { ImportedHighTexV2 } from "@hightex/importer";

/** Stored records captured together, before serialization or rendering. */
export interface DocumentSnapshot {
  document: HighTexDocument;
  chapters: HighTexChapter[];
  cites: CiteRecord[];
  aliases: Alias[];
  variables: Variable[];
  images: ImageRecord[];
}

export interface DocumentAsset {
  bytes: Uint8Array;
  mime: string;
}

/** Rendering needs document content, without an archive/importer envelope. */
export type DocumentRenderModel = Pick<
  ImportedHighTexV2,
  "document" | "config" | "references" | "variables" | "aliases" | "profile"
> & {
  chapters: { id: string; content: HighTexChapter["content"] }[];
  images: Record<string, DocumentAsset>;
  profilePicture?: DocumentAsset;
};
