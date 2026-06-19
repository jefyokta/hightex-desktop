export {};

declare global {
  interface Entity {
    createdAt: Date | string;
    id: string;
  }
  interface CommentEntity extends Entity {
    data: Omit<SelectionPayload, "text">;
    type: SharingType | string;
    text: string;
    documentId: string;
    role: string;
    participantId: string;
  }

  interface SharingEntity extends Entity {
    updatedAt: Date | string|null;
    filePath: string;
  }
}
