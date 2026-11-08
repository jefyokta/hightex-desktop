import { BrowserWindow } from "electron";
import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  cpSync,
} from "node:fs";
import path from "node:path";
import { serialize } from "node:v8";
import type { Application } from "../main/application";
import { WorkspaceRegistry } from "./registry";
import {
  cloudWorkspace,
  planWorkspaceMigration,
  selectWorkspaceData,
} from "./migration-plan";
import { canonicalWorkspaceSnapshot } from "../../src/workspaces/snapshot";
import {
  normalizeWorkspaceServer,
  workspaceHost,
} from "../../src/workspaces/identity";
import { Snapshot } from "../database/models/snapshot";
import { Comment } from "../database/models/comment";
import { LocalLecturer } from "../database/models/lecturer";

interface LegacyData {
  app?: ConfigShape;
  profile?: Profile;
  hightex?: unknown;
  session?: {
    user?: User;
    serverUrl?: string;
    expiresAt?: string;
    browser?: unknown;
  };
  bindings?: Record<string, CloudBinding>;
  documents?: Record<string, unknown>;
  pending?: Record<string, unknown>;
  completed?: string[];
  attempts?: Record<string, unknown>;
  entries?: unknown[];
}
const readJson = (file: string): LegacyData => {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
};
const writeJson = (file: string, value: unknown) =>
  writeFileSync(file, JSON.stringify(value, null, 2), { mode: 0o600 });

export class WorkspaceMigration {
  private snapshot?: WorkspaceDataSnapshot;
  private plan?: WorkspaceMigrationPlan;
  private target?: {
    window: BrowserWindow;
    snapshot: WorkspaceDataSnapshot;
    hash: string;
    resolve(): void;
    reject(error: Error): void;
  };
  private running = false;
  constructor(
    private registry: WorkspaceRegistry,
    private application: Application,
  ) {}

  preview(snapshot: WorkspaceDataSnapshot) {
    if (this.running) throw Error("Migration is running");
    if (
      !snapshot ||
      !Array.isArray(snapshot.tables?.documents) ||
      !snapshot.localStorage
    )
      throw Error("Invalid migration snapshot");
    const bindings = Object.values(
      readJson(path.join(this.registry.root, "document-sync-v2.json"))
        .bindings ?? {},
    ) as CloudBinding[];
    this.plan = planWorkspaceMigration(
      snapshot.tables.documents as unknown as HighTexDocument[],
      bindings,
      this.registry.cloudServerUrl,
    );
    const session = readJson(
      path.join(this.registry.root, "config.json"),
    ).session;
    if (session?.serverUrl && session?.user?.id) {
      try {
        const profile = cloudWorkspace(
          session.serverUrl,
          String(session.user.id),
          this.registry.cloudServerUrl,
        );
        if (!this.plan.profiles.some((item) => item.id === profile.id))
          this.plan.profiles.push({
            ...profile,
            name: `Cloud ${this.plan.profiles.filter((item) => item.type === "cloud").length + 1}`,
          });
      } catch {
        // Unsupported legacy sessions remain in the untouched source backup.
      }
    }
    this.plan.summary = Object.fromEntries(
      this.plan.profiles.map((profile) => {
        const documents = Object.entries(this.plan!.assignments)
          .filter(([, target]) => target === profile.id)
          .map(([id]) => id);
        const selected = selectWorkspaceData(
          snapshot,
          this.plan!.assignments,
          profile.id,
        );
        return [
          profile.id,
          {
            documents: documents.length,
            branches: documents.filter((id) =>
              Boolean(
                (snapshot.tables.documents as unknown as HighTexDocument[]).find(
                  (document) => document.id === id,
                )?.parentId,
              ),
            ).length,
            assets: selected.tables.images?.length ?? 0,
            forms: Object.keys(selected.localStorage).filter((key) =>
              key.startsWith("hightex:forms:v1:"),
            ).length,
          },
        ];
      }),
    );
    this.snapshot = snapshot;
    return this.plan;
  }

  targetSnapshot(window: BrowserWindow) {
    if (this.target?.window !== window)
      throw Error("Unexpected migration window");
    return this.target.snapshot;
  }

  verified(window: BrowserWindow, hash: string) {
    if (this.target?.window !== window)
      throw Error("Unexpected migration window");
    if (hash !== this.target.hash) {
      this.target.reject(Error("Workspace verification failed"));
      throw Error("Workspace verification failed");
    }
    this.target.resolve();
  }

  async run(resolutions: Record<string, string>) {
    if (this.running || !this.snapshot || !this.plan)
      throw Error("Preview the migration first");
    const { snapshot, plan } = this;
    const assignments = { ...plan.assignments };
    const documents = snapshot.tables.documents as unknown as HighTexDocument[];
    for (const conflict of plan.conflicts) {
      const destination = resolutions[conflict.documentId];
      if (!plan.profiles.some((profile) => profile.id === destination))
        throw Error("Resolve all migration conflicts");
      if (conflict.reason.includes("binding") && destination !== "local")
        throw Error("Ambiguous cloud bindings must remain in Local for review");
      if (
        destination !== "local" &&
        destination !== plan.assignments[conflict.documentId]
      )
        throw Error(
          "The destination does not match the existing cloud binding",
        );
      const members = new Set([conflict.documentId]);
      let changed = true;
      while (changed) {
        changed = false;
        documents.forEach((document) => {
          if (
            document.parentId &&
            members.has(document.parentId) &&
            !members.has(document.id)
          ) {
            members.add(document.id);
            changed = true;
          }
        });
      }
      members.forEach((id) => {
        assignments[id] = destination;
      });
    }
    this.running = true;
    const backup = path.join(this.registry.root, "workspace-migration-v1");
    mkdirSync(backup, { recursive: true });
    let currentProfileId = "";
    try {
      // Source data is retained. A failed attempt only overwrites inactive targets.
      writeFileSync(path.join(backup, "source.bin"), serialize(snapshot), {
        mode: 0o600,
      });
      const legacyConfig = readJson(
        path.join(this.registry.root, "config.json"),
      );
      for (const filename of [
        "config.json",
        "session.bin",
        "document-sync-v2.json",
        "advisor-review.json",
        "submission-attempts.json",
        "lecturer-directory.json",
        "installed.json",
      ])
        if (existsSync(path.join(this.registry.root, filename)))
          copyFileSync(
            path.join(this.registry.root, filename),
            path.join(backup, filename),
          );
      const sqlite = path.join(this.registry.root, "hightex.db");
      const sqliteBackup = path.join(backup, "hightex.db");
      if (existsSync(sqlite)) {
        const source = new Database(sqlite, { readonly: true });
        try {
          await source.backup(sqliteBackup);
        } finally {
          source.close();
        }
      }
      const state = this.registry.read();
      state.profiles = plan.profiles;
      this.registry.write(state); // Needed to serve the registered staging origins.
      const journal = {
        assignments,
        profiles: plan.profiles,
        completed: [] as string[],
        complete: false,
      };
      writeJson(path.join(backup, "journal.json"), journal);
      for (const profile of plan.profiles) {
        currentProfileId = profile.id;
        this.progress(profile.id, "copying");
        const directory = this.registry.directory(profile.id);
        mkdirSync(directory, { recursive: true });
        this.copyMainData(profile, assignments, legacyConfig, backup);
        if (existsSync(sqliteBackup))
          this.copySqlite(profile, assignments, sqliteBackup);
        const selected = selectWorkspaceData(snapshot, assignments, profile.id);
        selected.tables.documents = selected.tables.documents.map((row) => {
          const document = row as unknown as HighTexDocument;
          return this.canFollowWorkspaceIdentity(
            document,
            profile,
            legacyConfig,
          )
            ? { ...row, authorProfileMode: "workspace" }
            : { ...row, authorProfileMode: "document" };
        });
        const brokenRoots = new Set(
          plan.conflicts
            .filter((conflict) => conflict.reason.includes("parent"))
            .map((conflict) => conflict.documentId),
        );
        selected.tables.documents = selected.tables.documents.map((row) =>
          brokenRoots.has(String(row.id)) ? { ...row, parentId: null } : row,
        );
        selected.tables.documents = selected.tables.documents.map((row) =>
          typeof row.file === "string"
            ? { ...row, file: this.copyImportedFile(row.file, profile) }
            : row,
        );
        if (selected.tables.file)
          selected.tables.file = selected.tables.file
            .map((row) =>
              typeof row.filePath === "string"
                ? {
                    ...row,
                    filePath: this.copyImportedFile(row.filePath, profile),
                  }
                : row,
            )
            .sort((a, b) =>
              String(a.filePath) < String(b.filePath)
                ? -1
                : String(a.filePath) > String(b.filePath)
                  ? 1
                  : 0,
            );
        this.progress(profile.id, "verifying");
        await this.restore(profile, selected);
        this.progress(profile.id, "complete");
        journal.completed.push(profile.id);
        writeJson(path.join(backup, "journal.json"), journal);
      }
      journal.complete = true;
      writeJson(path.join(backup, "journal.json"), journal);
      this.registry.write({
        ...state,
        activeId: "local",
        migrationComplete: true,
      });
    } catch (error) {
      if (currentProfileId) this.progress(currentProfileId, "failed");
      throw error;
    } finally {
      this.running = false;
    }
  }

  private progress(
    profileId: string,
    status: WorkspaceMigrationProgress["status"],
  ) {
    this.application.window?.webContents.send("workspaces:migration:progress", {
      profileId,
      status,
    } satisfies WorkspaceMigrationProgress);
  }

  private canFollowWorkspaceIdentity(
    document: HighTexDocument,
    profile: WorkspaceProfile,
    legacy: LegacyData,
  ) {
    const author = document.profile;
    const oldAccount =
      profile.type === "cloud" &&
      String(legacy.session?.user?.id ?? "") === profile.accountId
        ? legacy.session?.user
        : undefined;
    const expectedName =
      profile.type === "local"
        ? legacy.profile?.name ?? ""
        : oldAccount?.name ?? "";
    const expectedNim =
      profile.type === "local"
        ? legacy.profile?.nim ?? ""
        : oldAccount?.identity_number ?? "";
    const expectedCv =
      profile.type === "local" ? legacy.profile?.cv ?? "" : "";
    if (
      (author?.name && author.name !== expectedName) ||
      (author?.nim && author.nim !== expectedNim) ||
      (author?.cv && author.cv !== expectedCv)
    )
      return false;

    const picture = author?.picture as
      | { __hightexWorkspaceBlob?: boolean; bytes?: Uint8Array }
      | undefined;
    if (!picture) return true;
    if (!picture.__hightexWorkspaceBlob || !(picture.bytes instanceof Uint8Array))
      return false;
    if (profile.type !== "local") return false;
    const defaultPicture = path.join(this.registry.root, "images", "profile_picture.webp");
    if (!existsSync(defaultPicture)) return false;
    return Buffer.from(picture.bytes).equals(readFileSync(defaultPicture));
  }

  private copyImportedFile(file: string, profile: WorkspaceProfile): string {
    const imported = path.join(this.registry.root, "imported-documents");
    const relative = path.relative(imported, file);
    if (
      !relative ||
      relative === ".." ||
      relative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relative)
    )
      return file;
    const target = path.join(
      this.registry.directory(profile.id),
      "imported-documents",
      relative,
    );
    mkdirSync(path.dirname(target), { recursive: true });
    if (existsSync(file)) copyFileSync(file, target);
    return target;
  }

  private copyMainData(
    profile: WorkspaceProfile,
    assignments: Record<string, string>,
    config: LegacyData,
    backup: string,
  ) {
    const directory = this.registry.directory(profile.id);
    const sameScope = (server: unknown, account: unknown) => {
      try {
        return (
          typeof server === "string" &&
          normalizeWorkspaceServer(server) === profile.serverUrl &&
          String(account) === profile.accountId
        );
      } catch {
        return false;
      }
    };
    const session = config.session;
    const copySession =
      session && sameScope(session.serverUrl, session.user?.id);
    const next: Record<string, unknown> = { app: config.app };
    if (profile.id === "local") next.profile = config.profile;
    // Category cache has no host provenance; copy only to Local and the legacy session's host.
    if (
      profile.id === "local" ||
      (session?.serverUrl &&
        normalizeWorkspaceServer(session.serverUrl) === profile.serverUrl)
    )
      next.hightex = config.hightex;
    if (copySession) {
      next.session = {
        user: session.user,
        serverUrl: session.serverUrl,
        expiresAt: session.expiresAt,
      };
      if (existsSync(path.join(backup, "session.bin")))
        copyFileSync(
          path.join(backup, "session.bin"),
          path.join(directory, "session.bin"),
        );
    }
    writeJson(path.join(directory, "config.json"), next);
    if (existsSync(path.join(backup, "installed.json")))
      copyFileSync(
        path.join(backup, "installed.json"),
        path.join(directory, "installed.json"),
      );
    if (
      profile.id === "local" &&
      existsSync(path.join(this.registry.root, "images"))
    )
      cpSync(
        path.join(this.registry.root, "images"),
        path.join(directory, "images"),
        { recursive: true },
      );
    const bindings =
      readJson(path.join(backup, "document-sync-v2.json")).bindings ?? {};
    writeJson(path.join(directory, "document-sync-v2.json"), {
      bindings: Object.fromEntries(
        Object.entries(bindings).filter(([, item]) => {
          const binding = item as CloudBinding;
          // Quarantined conflicts keep their original bindings/locks in Local.
          return (
            (assignments[binding.localDocumentId] ?? "local") === profile.id &&
            (profile.id === "local" ||
              sameScope(binding.serverUrl, binding.accountId))
          );
        }),
      ),
    });
    const scopedKey = (key: string) => {
      try {
        const [server, account] = JSON.parse(key);
        return sameScope(server, account);
      } catch {
        return false;
      }
    };
    const advisor = readJson(path.join(backup, "advisor-review.json"));
    writeJson(path.join(directory, "advisor-review.json"), {
      documents: Object.fromEntries(
        Object.entries(advisor.documents ?? {}).filter(([key]) =>
          scopedKey(key),
        ),
      ),
      pending: Object.fromEntries(
        Object.entries(advisor.pending ?? {}).filter(([key]) => scopedKey(key)),
      ),
      completed: (advisor.completed ?? []).filter(scopedKey),
    });
    const attempts =
      readJson(path.join(backup, "submission-attempts.json")).attempts ?? {};
    writeJson(path.join(directory, "submission-attempts.json"), {
      attempts: Object.fromEntries(
        Object.entries(attempts).filter(([key]) => scopedKey(key)),
      ),
    });
    // Old user-created directory entries were shared; retain copies per workspace.
    if (existsSync(path.join(backup, "lecturer-directory.json"))) {
      const lecturers = readJson(path.join(backup, "lecturer-directory.json"));
      writeJson(path.join(directory, "lecturer-directory.json"), {
        entries: lecturers.entries ?? [],
      });
    }
    if (profile.serverUrl && profile.accountId) {
      const scope = createHash("sha256")
        .update(JSON.stringify([profile.serverUrl, profile.accountId]))
        .digest("hex");
      const source = path.join(this.registry.root, "cloud-backups", scope);
      if (existsSync(source))
        cpSync(source, path.join(directory, "cloud-backups", scope), {
          recursive: true,
        });
    }
  }

  private copySqlite(
    profile: WorkspaceProfile,
    assignments: Record<string, string>,
    backup: string,
  ) {
    const directory = this.registry.directory(profile.id);
    const target = path.join(directory, "hightex.db");
    copyFileSync(backup, target);
    const db = new Database(target);
    try {
      const snapshots = new Snapshot(db);
      const comments = new Comment(db);
      const lecturers = new LocalLecturer(db);
      snapshots.boot();
      comments.boot();
      lecturers.boot();
      db.transaction(() => {
        const rows = snapshots.get();
        for (const row of rows) {
          if ((assignments[row.documentId] ?? "local") !== profile.id) {
            comments.where("snapshotId", row.id).delete();
            snapshots.where("id", row.id).delete();
          } else if (existsSync(row.filePath)) {
            const destination = path.join(
              directory,
              "snapshots",
              path.basename(row.filePath),
            );
            mkdirSync(path.dirname(destination), { recursive: true });
            copyFileSync(row.filePath, destination);
            snapshots.where("id", row.id).update({ filePath: destination });
          }
        }
        if (profile.id !== "local") {
          const snapshotIds = new Set(
            snapshots.get().map((snapshot) => snapshot.id),
          );
          for (const comment of comments.get())
            if (!snapshotIds.has(comment.snapshotId))
              comments.where("id", comment.id).delete();
        }
      })();
      if (db.pragma("integrity_check", { simple: true }) !== "ok")
        throw Error("SQLite verification failed");
    } finally {
      db.close();
    }
  }

  private async restore(
    profile: WorkspaceProfile,
    snapshot: WorkspaceDataSnapshot,
  ) {
    const window = new BrowserWindow({
      show: false,
      webPreferences: {
        preload: this.application.preloadEntry,
        contextIsolation: true,
        backgroundThrottling: false,
      },
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const hash = createHash("sha256")
          .update(canonicalWorkspaceSnapshot(snapshot))
          .digest("hex");
        const timer = setTimeout(
          () => reject(Error("Workspace migration timed out")),
          120000,
        );
        this.target = {
          window,
          snapshot,
          hash,
          resolve: () => {
            clearTimeout(timer);
            resolve();
          },
          reject: (error) => {
            clearTimeout(timer);
            reject(error);
          },
        };
        window.once("closed", () => {
          clearTimeout(timer);
          reject(Error("Migration window closed"));
        });
        void window
          .loadURL(
            `hightex://${workspaceHost(profile.id)}/profiles/migration/target`,
          )
          .catch((error) => {
            clearTimeout(timer);
            reject(error);
          });
      });
    } finally {
      this.target = undefined;
      if (!window.isDestroyed()) window.destroy();
    }
  }
}
