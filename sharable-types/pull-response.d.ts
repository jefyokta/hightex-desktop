declare global {
  type PullResponse =
    | { status: "empty" }
    | { status: "not_found"; error: string; message: string }
    | { status: "downloaded"; file: Uint8Array; sha256: string };

  type CommitListResponse = {
    commits: Array<{
      id: number;
      document_id: string;
      sha256: string | null;
      type: string | null;
      meta: Record<string, unknown> | null;
      author: number | null;
      created_at: string;
      updated_at: string;
      message:string
    }>;
  };
}

export {};
