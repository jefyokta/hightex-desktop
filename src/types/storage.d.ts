import { JSONContent } from "@tiptap/core";
export {};



declare global {

  type CategoryVariant = "thesis" | "proposal" | "intern"
  interface HighTexFileMeta {
    filePath: string;
    lastUpdated: number;
  }
  interface Keywords {
    indonesian: string[];
    english: string[];
  }

  interface User {
    name: string;
    email: string;
    advisors: Mentor[];
    identity_number: string;
  }

  interface Variable {
    documentId: string;
    name: string;
    value: string;
  }

  interface RawCategory extends Category {
    chapters: string;
  }
  interface Category {
    name: string;
    chapters: {
      chapter: string;
      title: string;
    }[];
    id: number;
    variant: CategoryVariant;
    min?: boolean;
  }
  interface Mentor extends User {
    role: "primary" | "secondary";
  }
  interface HighTexChapter {
    id: string;
    content: JSONContent[];
  }
  interface HighTexConfig {
    consentDate?: Date;
    validityDate?: Date;
    statementDate?: Date;
    leader?: string;
    member_1?: string;
    member_2?: string;
    // intern only
    intern?: {
      onsite_at?: string;
      advisor?: {
        name?: string;
        nip?: string;
      };
      validity?: Date;
    }
  }
  interface HighTexDocument {
    id: string;
    category: string;
    title: string;
    altTitle: string;
    keywords: Keywords;
    config: HighTexConfig;
    updatedAt?: Date;
    file?: HighTexFileMeta;
    min?: boolean;
  }

  interface CiteRecord {
    key: string;
    bib: string;
  }

  interface ChapterGraph {
    id: string;
    data: {
      headings: HeadingGraph[];
      images: ImageGraph[];
      tables: TableGraph[];
    };
  }

  interface ImageRecord {
    id: string;
    blob: Blob;
    documentId: string;
    createdAt: number;
  }

  type SerialableImageRecord = Pick<ImageRecord, "id"> & {
    buffer: Uint8Array;
  };
}
