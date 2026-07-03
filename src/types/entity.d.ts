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
    snapshotId: string;
  }

  interface SnapshotEntity extends Entity {
    updatedAt: Date | string | null;
    filePath: string;
    type: SharingType | string;
    documentId: string;
  }
}
