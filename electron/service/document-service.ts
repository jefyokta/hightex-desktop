import Store from "electron-store";
import { app } from "electron";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { CloudSyncClient } from "./cloud-sync-client";
import { ServerService } from "./server-service";
import { SessionService } from "./session-service";
import { CategoryService } from "./category-service";
import { CloudAcademicClient } from "./cloud-academic-client";

// Legacy global hashes/aliases are retained in their original store as backups.
const store = new Store<{ bindings: Record<string, CloudBinding> }>({
  name: "document-sync-v2",
});

export const documentService: CloudSyncClient = new CloudSyncClient({
  session: () => {
    const user = SessionService.getUser();
    const token = SessionService.getToken();
    return user && token
      ? {
          serverUrl: ServerService.getServerUrl(),
          accountId: String(user.id),
          token,
        }
      : null;
  },
  request: (endpoint, options) =>
    ServerService.documentSyncRequest(endpoint, options, "document sync"),
  readBindings: () => store.get("bindings") ?? {},
  writeBindings: (bindings) => store.set("bindings", bindings),
  category: (document) => CategoryService.get(document.category),
  validatePush: (input, documentId) =>
    cloudAcademicService.verify(input, documentId),
  backup: async (session, file) => {
    const scope = createHash("sha256")
      .update(JSON.stringify([session.serverUrl, session.accountId]))
      .digest("hex");
    const directory = path.join(
      app.getPath("userData"),
      "cloud-backups",
      scope,
    );
    await mkdir(directory, { recursive: true });
    const sha256 = createHash("sha256").update(file).digest("hex");
    const target = path.join(directory, `${sha256}.hightex`);
    await writeFile(target, file);
    return target;
  },
});

export const cloudAcademicService: CloudAcademicClient =
  new CloudAcademicClient({
    context: () => documentService.context(),
    request: (endpoint) =>
      ServerService.documentSyncRequest(
        endpoint,
        { method: "GET", signal: AbortSignal.timeout(30000) },
        "cloud academic data",
      ),
  });
