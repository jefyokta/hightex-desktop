export {};

declare global {
  interface Entity {
    createdAt: Date | string;
    id: string;
  }
  interface CommentEntity extends Entity {
    data: Omit<SelectionPayload, "text">;
    text: string;
    role: string;
    participantId: string;
    snapshotId:string
  }

  interface SnapshotEntity extends Entity {
    updatedAt: Date | string | null;
    filePath: string;
    type: SharingType | string;
    documentId: string;


  }

  interface DocumentEntity extends Entity{
    id: string;
    category: string;
    title: string;
    altTitle: string;
    keywords: Keywords;
    config: HighTexConfig;
    file?: HighTexFileMeta;
    updatedAt:Date|null
  }

  interface CategoryEntity extends Entity{
    name: string;
    chapters: {
      chapter: string;
      title: string;
    }[];
    min?: boolean;
  }

  interface GraphEntity extends Entity {
    
  }
}
