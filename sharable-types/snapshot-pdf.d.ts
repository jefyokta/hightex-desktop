import type { SnapshotSource } from "../src/review/snapshot-reader";
export {};
declare global {
  interface SnapshotPDFInput {
    file: Uint8Array;
    source: SnapshotSource;
    documentId: string;
  }
  interface SnapshotPDFPayload {
    title: string;
    author: string;
    keywords: string[];
    sha256: string;
    documentId: string;
    incomplete: boolean;
  }
  interface SnapshotPrintAPI {
    init(
      request: string,
    ): Promise<SnapshotPDFInput & { categories: Category[] }>;
    result(request: string, payload: SnapshotPDFPayload): void;
    error(request: string, code: string): void;
  }
}
