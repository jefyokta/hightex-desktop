export {};

declare global {
  type LecturerSource =
    | { type: "manual" }
    | { type: "file"; filename?: string }
    | { type: "cloud"; url: string }
    | { type: "unknown" };
  interface LecturerDirectoryEntry extends AcademicPerson {
    id: string;
    source: LecturerSource;
  }
  interface LecturerDirectoryState {
    data: LecturerDirectoryEntry[];
    error?: "storage";
  }
  interface LecturerDirectoryInput {
    id?: string;
    name: string;
    nip: string;
  }
  interface LecturerDirectoryImportResult extends LecturerDirectoryState {
    added: number;
    skipped: number;
  }
  interface LecturerDirectoryAPI {
    list(): Promise<LecturerDirectoryState>;
    save(input: LecturerDirectoryInput): Promise<
      LecturerDirectoryState & {
        entry: LecturerDirectoryEntry;
      }
    >;
    remove(id: string): Promise<LecturerDirectoryState>;
    import(
      data: unknown,
      filename?: string,
    ): Promise<LecturerDirectoryImportResult>;
  }
}
