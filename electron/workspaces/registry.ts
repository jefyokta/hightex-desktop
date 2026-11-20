import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { normalizeWorkspaceServer, workspaceHost } from "./identity";
import {
  cachedWorkspaceEmail,
  workspaceAccountEmail,
} from "./account-identity";

export class WorkspaceRegistry {
  constructor(
    readonly root: string,
    readonly cloudServerUrl: string,
  ) {
    if (normalizeWorkspaceServer(cloudServerUrl) !== cloudServerUrl)
      throw Error("Invalid configured workspace server");
  }

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
          {
            id: "local",
            name: "Lokal",
            type: "local",
            serverUrl: null,
            accountId: null,
          },
        ],
        migrationComplete: !hasLegacyWorkspace(this.root),
      };
      this.write(state);
    }
    if (
      !state ||
      !Array.isArray(state.profiles) ||
      typeof state.migrationComplete !== "boolean" ||
      !state.profiles.length ||
      !state.profiles.some((profile) => profile.id === state.activeId) ||
      new Set(state.profiles.map((profile) => profile.id)).size !==
        state.profiles.length
    )
      throw Error("Invalid workspace registry");
    const before = JSON.stringify(state);
    let cloudNumber = 0;
    state.profiles.forEach((profile) => {
      if (profile.legacyCloudBinding) {
        const binding = profile.legacyCloudBinding;
        let previousServer: string | undefined;
        try {
          previousServer = normalizeWorkspaceServer(binding.serverUrl);
        } catch {
          // Preserve malformed historical metadata; it cannot choose a login endpoint.
        }
        // Recover profiles downgraded by earlier builds without moving their data.
        if (previousServer) {
          profile.serverUrl = previousServer;
          profile.accountId = binding.accountId;
          profile.type = "cloud";
          delete profile.legacyCloudBinding;
        }
      }
      const legacyType = !profile.type;
      profile.type ??= profile.serverUrl ? "cloud" : "local";
      profile.accountId ??= null;
      profile.serverUrl ??= null;
      if (profile.type === "cloud") {
        cloudNumber++;
        profile.serverUrl = normalizeWorkspaceServer(profile.serverUrl ?? "");
        if (
          legacyType &&
          profile.name ===
            `${new URL(profile.serverUrl).host} · ${profile.accountId}`
        )
          profile.name = `Cloud ${cloudNumber}`;
        if (!profile.accountId) profile.loginOnFirstUse ??= true;
        profile.accountEmail =
          workspaceAccountEmail(profile.accountEmail) ??
          cachedWorkspaceEmail(
            path.join(this.directory(profile.id), "config.json"),
            profile,
          );
        if (!profile.accountEmail) delete profile.accountEmail;
      } else {
        delete profile.accountEmail;
      }
    });
    state.profiles.forEach((profile) => {
      workspaceHost(profile.id);
      if (typeof profile.name !== "string" || !profile.name.trim())
        throw Error("Invalid workspace name");
      if (profile.type !== "local" && profile.type !== "cloud")
        throw Error("Invalid workspace type");
      if (profile.type === "local" && profile.serverUrl !== null)
        throw Error("Local workspaces cannot have a cloud server");
      if (profile.type === "cloud" && typeof profile.serverUrl !== "string")
        throw Error("Cloud workspaces need a server");
      if (profile.pendingCloudBinding && profile.type !== "local")
        throw Error("Only local workspaces can be connected to Cloud");
      if (profile.serverUrl !== null) {
        if (
          typeof profile.serverUrl !== "string" ||
          normalizeWorkspaceServer(profile.serverUrl) !== profile.serverUrl
        )
          throw Error("Invalid workspace server");
      }
      if (profile.accountId !== null) {
        if (typeof profile.accountId !== "string")
          throw Error("Invalid workspace account");
        if (profile.type !== "cloud")
          throw Error("Local workspaces cannot have a cloud account");
      }
    });
    if (JSON.stringify(state) !== before) this.write(state);
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

  create(input: { name: string; type: "local" | "cloud" }): WorkspaceState {
    if (
      !input ||
      typeof input.name !== "string" ||
      !input.name.trim() ||
      input.name.length > 100 ||
      (input.type !== "local" && input.type !== "cloud")
    )
      throw Error("Invalid workspace details");
    const state = this.read();
    if (!state.migrationComplete) throw Error("Migration required");
    this.assertNameAvailable(state, input.name.trim());
    const profile: WorkspaceProfile = {
      id: randomUUID(),
      name: input.name.trim(),
      // The account binding promotes a Local workspace to Cloud only after
      // authentication succeeds.
      type: "local",
      serverUrl: null,
      accountId: null,
      ...(input.type === "cloud" ? { pendingCloudBinding: true } : {}),
    };
    state.profiles.push(profile);
    mkdirSync(this.directory(profile.id), { recursive: true });
    this.write(state);
    return state;
  }

  rename(id: string, name: string): WorkspaceState {
    if (typeof name !== "string" || !name.trim() || name.length > 100)
      throw Error("Invalid workspace name");
    const state = this.read();
    const profile = state.profiles.find((item) => item.id === id);
    if (!profile) throw Error("Unknown workspace");
    this.assertNameAvailable(state, name.trim(), id);
    profile.name = name.trim();
    this.write(state);
    return state;
  }

  assertCanDelete(id: string): WorkspaceState {
    const state = this.read();
    if (!state.profiles.some((profile) => profile.id === id))
      throw Error("Unknown workspace");
    if (id === "local") throw Error("The default workspace cannot be deleted");
    if (id === state.activeId)
      throw Error("The active workspace cannot be deleted");
    if (state.profiles.length <= 1)
      throw Error("At least one workspace must remain");
    return state;
  }

  delete(id: string): WorkspaceState {
    const state = this.assertCanDelete(id);
    rmSync(this.directory(id), { recursive: true, force: true });
    state.profiles = state.profiles.filter((profile) => profile.id !== id);
    this.write(state);
    return state;
  }

  beginCloudBinding(id: string): WorkspaceState {
    const state = this.read();
    const profile = state.profiles.find((item) => item.id === id);
    if (!profile) throw Error("Unknown workspace");
    if (profile.type !== "local")
      throw Error("Only local workspaces can be connected to Cloud");
    profile.pendingCloudBinding = true;
    this.write(state);
    return state;
  }

  cancelCloudBinding(id: string): WorkspaceState {
    const state = this.read();
    const profile = state.profiles.find((item) => item.id === id);
    if (!profile) throw Error("Unknown workspace");
    if (profile.type !== "local" || !profile.pendingCloudBinding)
      throw Error("This workspace has no pending Cloud connection");
    delete profile.pendingCloudBinding;
    this.write(state);
    return state;
  }

  private assertNameAvailable(
    state: WorkspaceState,
    name: string,
    exceptId?: string,
  ) {
    if (
      state.profiles.some(
        (profile) =>
          profile.id !== exceptId &&
          profile.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase(),
      )
    )
      throw Error("Workspace name already exists");
  }

  bindAccount(accountId: string, email?: string) {
    if (typeof accountId !== "string" || !accountId)
      throw Error("Invalid workspace account");
    const state = this.read();
    const profile = state.profiles.find((item) => item.id === state.activeId)!;
    const upgradingLocal =
      profile.type === "local" && profile.pendingCloudBinding;
    if (
      (!upgradingLocal && profile.type !== "cloud") ||
      (profile.serverUrl === this.cloudServerUrl &&
        profile.accountId &&
        profile.accountId !== accountId)
    )
      throw Error("This account belongs in a different workspace");
    if (
      state.profiles.some(
        (item) =>
          item.id !== profile.id &&
          item.type === "cloud" &&
          item.serverUrl === this.cloudServerUrl &&
          item.accountId === accountId,
      )
    )
      throw Error("This account already has a workspace");
    profile.type = "cloud";
    profile.serverUrl = this.cloudServerUrl;
    profile.accountId = accountId;
    delete profile.legacyCloudBinding;
    if (email !== undefined) {
      const normalized = workspaceAccountEmail(email);
      if (!normalized) throw Error("Invalid workspace email");
      profile.accountEmail = normalized;
    }
    profile.loginOnFirstUse = false;
    delete profile.pendingCloudBinding;
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
