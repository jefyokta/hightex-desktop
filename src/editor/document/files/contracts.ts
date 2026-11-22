import type { JSONContent } from "@tiptap/core";

export interface ChapterBuffer {
  id: string;
  content: JSONContent[];
}

export interface EditingChapter {
  snapshot(): ChapterBuffer | undefined;
  flush(): Promise<void>;
}

export interface DocumentFileStatus {
  path?: string;
  savedAt?: number;
  missing: boolean;
  modified: boolean;
}

export interface DocumentSaveState extends DocumentFileStatus {
  ready: boolean;
  saving: boolean;
  error?: DocumentSaveFailure;
  externalChanged?: boolean;
}

export interface FileBaseline {
  filePath: string;
  documentId: string;
  draftRevision: string;
  savedAt?: number;
  presentationRevision?: string;
}

export type RecoveryDocument = HighTexDocument & {
  recovery: NonNullable<HighTexDocument["recovery"]>;
};
