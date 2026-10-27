export {};

declare global {
  interface CloudSession {
    sessionId: string;
    serverUrl: string;
    accountId: string;
  }
  interface CloudBinding {
    serverUrl: string;
    accountId: string;
    localDocumentId: string;
    serverDocumentId: string;
    baseSha256: string;
  }
  interface CloudDownload {
    status: "downloaded";
    session: CloudSession;
    downloadId: string;
    serverDocumentId: string;
    sha256: string;
    archive: boolean;
    file: Uint8Array;
  }
  interface CloudPushInput {
    sessionId: string;
    file: Uint8Array;
    document: HighTexDocument;
    message: string;
    expectedServerDocumentId: string | null;
    expectedCloudSha256: string | null;
    replace: boolean;
    /** Explicitly overwrite a reviewed cloud version after backing it up. */
    force?: boolean;
  }
  interface CloudAPI {
    academic: CloudAcademicAPI;
    context(): Promise<CloudSession>;
    list(sessionId: string): Promise<CommitListResponse>;
    binding(sessionId: string, localId: string): Promise<CloudBinding | null>;
    pull(input: {
      sessionId: string;
      serverDocumentId: string;
      sha256?: string;
    }): Promise<CloudDownload | { status: "empty" | "not_found" }>;
    accept(input: {
      sessionId: string;
      downloadId: string;
      localDocumentId: string;
    }): Promise<CloudBinding>;
    push(input: CloudPushInput): Promise<
      | {
          status: "saved";
          changed: boolean;
          sha256: string;
          serverDocumentId: string;
        }
      | { status: "conflict"; sha256: string }
    >;
    backup(sessionId: string, file: Uint8Array): Promise<string>;
  }
}
