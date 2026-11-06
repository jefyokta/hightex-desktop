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

  interface LecturerEntity extends Entity {
    name: string;
    nip: string;
    source_type: LecturerSource["type"];
    source_detail: string | null;
  }
}
