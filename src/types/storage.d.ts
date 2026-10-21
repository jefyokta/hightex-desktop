import { JSONContent } from "@tiptap/core";
export {};

declare global {
  type CategoryVariant = "thesis" | "proposal" | "intern";
  interface HighTexFileMeta {
    filePath: string;
    lastUpdated: number;
  }
  interface Keywords {
    indonesian: string[];
    english: string[];
  }
  type Role = "student" | "advisor";
  interface RawRole {
    id: number;
    name: Role;
  }
  type RawRoles = RawRole[];

  type User<TRole extends Role = Role> = RawUser & {
    role: TRole;
  } & RoleSpecificProps<TRole>;

  type RoleSpecificProps<TRole extends Role> = TRole extends "advisor"
    ? { students?: User<"student">[] }
    : TRole extends "student"
      ? { advisors?: User<"advisor">[] }
      : {};

  interface RawUser {
    id: string;
    name: string;
    email: string;
    advisors: Mentor[];
    identity_number: string;
    roles: RawRoles;
  }

  interface Variable {
    documentId: string;
    name: string;
    value: string;
  }

  interface Alias {
    documentId: string;
    key: string;
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
    };
    kaprodi?: {
      name?: string;
      nip?: string;
    };
    dekan?: {
      name?: string;
      nip?: string;
    };
  }
  interface HighTexDocument {
    id: string;
    category: string;
    title: string;
    altTitle: string;
    keywords: Keywords;
    config: HighTexConfig;
    profile?: AuthorProfile;
    updatedAt?: Date;
    file?: string;
    min?: boolean;
  }

  interface CiteRecord {
    key: string;
    bib: string;
    documentId?: string;
  }

  interface ChapterGraph {
    id: string;
    data: ChapterGraphData;
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
