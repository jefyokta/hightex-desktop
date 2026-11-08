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
import {
  normalizeWorkspaceServer,
  PRODUCTION_WORKSPACE_SERVER,
  workspaceHost,
} from "../../src/workspaces/identity";

export class WorkspaceRegistry {
  constructor(
    readonly root: string,
    readonly cloudServerUrl = PRODUCTION_WORKSPACE_SERVER,
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
    let cloudNumber = 0;
    let localCopyNumber = 0;
    let needsFirstLoginFlag = false;
    state.profiles.forEach((profile) => {
      if (
        profile.type === "cloud" &&
        !profile.accountId &&
        profile.loginOnFirstUse === undefined
      ) {
        profile.loginOnFirstUse = true;
        needsFirstLoginFlag = true;
      }
    });
    const legacyProfiles = state.profiles.some(
      (profile) =>
        !profile.type ||
        (profile.type === "cloud" &&
          profile.serverUrl !== this.cloudServerUrl),
    );
    if (legacyProfiles) {
      state.profiles = state.profiles.map((profile) => {
        const type = profile.type ?? (profile.serverUrl ? "cloud" : "local");
        if (type !== "cloud")
          return {
            ...profile,
            type,
            serverUrl: profile.serverUrl ?? null,
            accountId: profile.accountId ?? null,
          };
        let serverUrl = "";
        try {
          serverUrl = normalizeWorkspaceServer(profile.serverUrl ?? "");
        } catch {
          serverUrl = String(profile.serverUrl ?? "");
        }
        if (serverUrl === this.cloudServerUrl) {
          if (!profile.type) cloudNumber++;
          const generatedName = (() => {
            try {
              return `${new URL(serverUrl).host} · ${profile.accountId}`;
            } catch {
              return undefined;
            }
          })();
          return {
            ...profile,
            name:
              profile.name === generatedName
                ? `Cloud ${cloudNumber}`
                : profile.name,
            type,
            serverUrl,
            accountId: profile.accountId ?? null,
            ...(!profile.accountId ? { loginOnFirstUse: true } : {}),
          };
        }
        localCopyNumber++;
        const oldGeneratedName = (() => {
          try {
            return `${new URL(serverUrl).host} · ${profile.accountId}`;
          } catch {
            return undefined;
          }
        })();
        const oldNameWasGenerated = profile.name === oldGeneratedName;
        return {
          ...profile,
          name: oldNameWasGenerated
            ? `Salinan lokal ${localCopyNumber}`
            : profile.name,
          type: "local" as const,
          serverUrl: null,
          accountId: null,
          legacyCloudBinding: {
            serverUrl,
            accountId: profile.accountId ?? null,
          },
        };
      });
    }
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
    if (legacyProfiles || needsFirstLoginFlag) this.write(state);
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
    if (id === state.activeId) throw Error("The active workspace cannot be deleted");
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
    if (profile.legacyCloudBinding)
      throw Error("This workspace has an unsupported legacy Cloud binding");
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

  private assertNameAvailable(state: WorkspaceState, name: string, exceptId?: string) {
    if (
      state.profiles.some(
        (profile) =>
          profile.id !== exceptId &&
          profile.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase(),
      )
    )
      throw Error("Workspace name already exists");
  }

  bindAccount(accountId: string) {
    if (typeof accountId !== "string" || !accountId)
      throw Error("Invalid workspace account");
    const state = this.read();
    const profile = state.profiles.find((item) => item.id === state.activeId)!;
    const upgradingLocal =
      profile.type === "local" && profile.pendingCloudBinding;
    if (
      (!upgradingLocal && profile.type !== "cloud") ||
      (profile.type === "cloud" &&
        profile.serverUrl !== this.cloudServerUrl) ||
      (profile.accountId && profile.accountId !== accountId)
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
