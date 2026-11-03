export {};

declare global {
  interface LecturerDirectoryEntry extends AcademicPerson {
    id: string;
  }
  interface LecturerDirectoryPayload {
    schema_version: 1;
    version: string;
    data: LecturerDirectoryEntry[];
  }
  interface LecturerDirectoryState {
    source: string;
    data: LecturerDirectoryEntry[];
    version: string | null;
    checkedAt: number | null;
    fromSeed: boolean;
    error?: "network" | "invalid" | "storage";
  }
  interface LecturerDirectoryAPI {
    cached(): Promise<LecturerDirectoryState>;
    refresh(force?: boolean): Promise<LecturerDirectoryState>;
  }
}
