import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import {
  normalizeWorkspaceServer,
  workspaceHost,
} from "../../src/workspaces/identity";

export class WorkspaceRegistry {
  constructor(readonly root: string) {}

  get file() {
    return path.join(this.root, "workspaces.json");
  }

  read(): WorkspaceState {
    let state: WorkspaceState;
    try {
      state = JSON.parse(readFileSync(this.file, "utf8"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      state = {
        activeId: "local",
        profiles: [
          { id: "local", name: "Local", serverUrl: null, accountId: null },
        ],
        migrationComplete: !hasLegacyWorkspace(this.root),
      };
      this.write(state);
    }
    if (
      !Array.isArray(state.profiles) ||
      typeof state.migrationComplete !== "boolean" ||
      !state.profiles.length ||
      !state.profiles.some((profile) => profile.id === state.activeId) ||
      new Set(state.profiles.map((profile) => profile.id)).size !==
        state.profiles.length
    )
      throw Error("Invalid workspace registry");
    state.profiles.forEach((profile) => {
      workspaceHost(profile.id);
      if (typeof profile.name !== "string" || !profile.name.trim())
        throw Error("Invalid workspace name");
      if (profile.serverUrl !== null) {
        if (
          typeof profile.serverUrl !== "string" ||
          normalizeWorkspaceServer(profile.serverUrl) !== profile.serverUrl
        )
          throw Error("Invalid workspace server");
      }
      if (profile.accountId !== null && typeof profile.accountId !== "string")
        throw Error("Invalid workspace account");
    });
    return state;
  }

  write(state: WorkspaceState) {
    mkdirSync(this.root, { recursive: true });
    const temporary = `${this.file}.${randomUUID()}.tmp`;
    writeFileSync(temporary, JSON.stringify(state, null, 2), { mode: 0o600 });
    renameSync(temporary, this.file);
  }

  directory(id: string) {
    workspaceHost(id);
    return path.join(this.root, "workspaces", id);
  }

  create(input: { name: string; serverUrl: string | null }): WorkspaceState {
    if (
      !input ||
      typeof input.name !== "string" ||
      !input.name.trim() ||
      input.name.length > 100
    )
      throw Error("Invalid workspace name");
    const state = this.read();
    if (!state.migrationComplete) throw Error("Migration required");
    const profile: WorkspaceProfile = {
      id: randomUUID(),
      name: input.name.trim(),
      serverUrl: input.serverUrl
        ? normalizeWorkspaceServer(input.serverUrl)
        : null,
      accountId: null,
    };
    state.profiles.push(profile);
    mkdirSync(this.directory(profile.id), { recursive: true });
    this.write(state);
    return state;
  }

  bindAccount(accountId: string) {
    if (typeof accountId !== "string" || !accountId)
      throw Error("Invalid workspace account");
    const state = this.read();
    const profile = state.profiles.find((item) => item.id === state.activeId)!;
    if (
      !profile.serverUrl ||
      (profile.accountId && profile.accountId !== accountId)
    )
      throw Error("This account belongs in a different workspace");
    profile.accountId = accountId;
    this.write(state);
    return profile;
  }
}

/** Fresh installations have no legacy data and must never enter migration. */
export function hasLegacyWorkspace(root: string): boolean {
  if (
    [
      "installed.json",
      "config.json",
      "hightex.db",
      "document-sync-v2.json",
      "session.bin",
    ].some((filename) => existsSync(path.join(root, filename)))
  )
    return true;
  const indexedDb = path.join(root, "IndexedDB");
  return (
    existsSync(indexedDb) &&
    readdirSync(indexedDb).some((name) =>
      /^(hightex_app_|https?_.*)(.*)\.indexeddb\./.test(name),
    )
  );
}
