import { HasStorage } from "./concerns/has-storage";
import { ServerService } from "./server-service";

export class DocumentService extends HasStorage<Record<string, string>> {
  protected storageName = "document_sha256";

  static async pull(
    _documentId?: string,
    archiveSHA256?: string,
  ): Promise<PullResponse> {
    const query = archiveSHA256
      ? `?sha256=${encodeURIComponent(archiveSHA256)}`
      : "";
    const result = await ServerService.documentSyncRequest<
      Uint8Array | Record<string, unknown>
    >(`/v2/documents/pull${query}`, { method: "GET" }, "pull document");

    if (result.status === 204) {
      return { status: "empty" };
    }

    if (result.status === 404) {
      return {
        status: "not_found",
        error: String((result.data as any)?.error ?? "document_not_found"),
        message: String((result.data as any)?.message ?? "Document not found"),
      };
    }

    if (!result.ok) {
      throw new Error(
        `Pull failed (HTTP ${result.status}): ${JSON.stringify(result.data)}`,
      );
    }

    if (!(result.data instanceof Uint8Array)) {
      throw new Error("Pull response did not contain a .hightex file");
    }

    const sha256 = result.headers.get("X-HighTex-SHA256");
    if (!sha256) {
      throw new Error("Pull response is missing X-HighTex-SHA256");
    }

    // Archive hashes must never become the base for a subsequent push.
    if (!archiveSHA256) this.setBaseSHA256("current", sha256);

    return {
      status: "downloaded",
      file: result.data,
      sha256,
    };
  }

  static async push(
    file: Uint8Array,
    _hash: string,
    document: HighTexDocument,
    message?:string,
    force = false,
  ): Promise<PushResponse> {
    const form = new FormData();

    form.append(
      "file",
      new Blob([new Uint8Array(file)], {
        type: "application/octet-stream",
      }),
      `${document.id}.hightex`,
    );

    const headers: Record<string, string> = {
      "X-Document-Title": encodeURIComponent(document.title),
      "X-Document-Category-ID": String(document.category ?? ""),
      "X-Document-Keywords-ID": encodeURIComponent(
        document.keywords.indonesian.join(","),
      ),
      "X-Document-Keywords-EN": encodeURIComponent(
        document.keywords.english.join(","),
      ),
      "X-Document-En-Title": encodeURIComponent(
        document.altTitle || document.title,
      ),
      "X-HighTex-Commit-Message":encodeURIComponent(message || "")
    };


    headers["X-HighTex-SHA256"] = _hash

    const baseSHA256 = this.getBaseSHA256("current");
    if (baseSHA256) {
      headers["X-HighTex-Base-SHA256"] = baseSHA256;
    }

    if (force) {
      headers["X-HighTex-Force"] = "true";
    }

    const result = await ServerService.documentSyncRequest<PushResponse>(
      "/v2/documents/push",
      {
        method: "POST",
        headers,
        body: form,
      },
      "push document",
    );

    if (
      result.status === 409 &&
      result.data &&
      typeof result.data === "object" &&
      "error" in result.data
    ) {
      return result.data;
    }

    if (!result.ok) {
      throw new Error(
        `Push failed (HTTP ${result.status}): ${JSON.stringify(result.data)}`,
      );
    }

    if (!result.data || !("sha256" in result.data)) {
      throw new Error("Push response is missing sha256");
    }

    this.setBaseSHA256("current", result.data.sha256);
    return result.data;
  }

  static async listCommits(): Promise<CommitListResponse> {
    const response =
      await ServerService.documentSyncRequest<CommitListResponse>(
        "/v2/documents/commits",
        { method: "GET" },
        "list document commits",
      );
    if (response.status === 404) return { commits: [] };
    if (!response.ok) {
      throw new Error(
        `List commits failed (HTTP ${response.status}): ${JSON.stringify(response.data)}`,
      );
    }
    const result = response.data;
    const current = result.commits?.find((commit) => commit.type === "current");
    if (current?.sha256) this.setBaseSHA256("current", current.sha256);
    else this.clearBaseSHA256("current");
    return result;
  }

  private static getBaseSHA256(documentId: string): string | undefined {
    return this.instance().storage.get()?.[documentId];
  }

  private static setBaseSHA256(documentId: string, hash: string): void {
    const store = this.instance().storage.get() || {};
    store[documentId] = hash;
    this.instance().storage.set(store);
  }

  private static clearBaseSHA256(documentId: string): void {
    const store = this.instance().storage.get() || {};
    delete store[documentId];
    this.instance().storage.set(store);
  }
}
