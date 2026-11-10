import { BrowserWindow, session } from "electron";
import type { Application } from "../main/application";
import { IPCMain } from "../utilities/ipc-main";
import { workspaceHost } from "./identity";
import { WorkspaceRuntime } from "./runtime";
import { WorkspaceRegistry } from "./registry";
import { WorkspaceMigration } from "./migration";
import { EditorWindow } from "../windows/editor-window";
import { desktopAuth } from "../service/auth-service";
import { restartApplication } from "../utilities/restart-application";

export function registerWorkspaceHandlers(application: Application) {
  if (!WorkspaceRuntime.root) return;
  if (!WorkspaceRuntime.serverUrl)
    throw Error("Workspace server is not initialized");
  const registry = new WorkspaceRegistry(
    WorkspaceRuntime.root,
    WorkspaceRuntime.serverUrl,
  );
  const migration = new WorkspaceMigration(registry, application);
  const legacy = (event: Electron.IpcMainInvokeEvent) => {
    const url = new URL(event.senderFrame?.url ?? "about:blank");
    const source =
      url.protocol === "hightex:"
        ? url.host === "app"
        : application.isDev &&
          process.env.VITE_DEV_SERVER_URL &&
          url.origin === new URL(process.env.VITE_DEV_SERVER_URL).origin;
    if (
      !WorkspaceRuntime.migrating ||
      !source ||
      url.pathname !== "/profiles/migration"
    )
      throw Error("Migration unavailable");
  };
  const senderWindow = (event: Electron.IpcMainInvokeEvent) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) throw Error("Window closed");
    return window;
  };
  const broadcastWorkspaceChange = () => {
    BrowserWindow.getAllWindows().forEach((window) => {
      if (!window.isDestroyed())
        window.webContents.send("workspaces:changed");
    });
  };
  IPCMain.handle("workspaces:state", () => registry.read());
  IPCMain.handle("workspaces:create", (_, input) => {
    const state = registry.create(input);
    broadcastWorkspaceChange();
    return state;
  });
  IPCMain.handle("workspaces:cloud:begin", (_, id: string) => {
    const state = registry.beginCloudBinding(id);
    if (state.activeId === id) {
      WorkspaceRuntime.profile = state.profiles.find(
        (profile) => profile.id === id,
      );
    }
    broadcastWorkspaceChange();
    return state;
  });
  IPCMain.handle("workspaces:cloud:cancel", (_, id: string) => {
    if (registry.read().activeId === id) desktopAuth.cancel();
    const state = registry.cancelCloudBinding(id);
    if (WorkspaceRuntime.profile?.id === id) {
      WorkspaceRuntime.profile = state.profiles.find(
        (profile) => profile.id === id,
      );
    }
    broadcastWorkspaceChange();
    return state;
  });
  IPCMain.handle("workspaces:rename", (_, id: string, name: string) => {
    const state = registry.rename(id, name);
    broadcastWorkspaceChange();
    return state;
  });
  IPCMain.handle("workspaces:delete", async (event, id: string) => {
    const sender = senderWindow(event);
    if (sender !== application.window)
      throw Error("Delete workspaces from the workspace dashboard");
    if (WorkspaceRuntime.switching) throw Error("Workspace switch in progress");
    if (
      BrowserWindow.getAllWindows().some(
        (window) => window !== sender && !window.isDestroyed(),
      )
    )
      throw Error("Close other windows before deleting a workspace");
    WorkspaceRuntime.switching = true;
    try {
      registry.assertCanDelete(id);
      await session.defaultSession.clearStorageData({
        origin: `hightex://${workspaceHost(id)}`,
      });
      const state = registry.delete(id);
      broadcastWorkspaceChange();
      return state;
    } finally {
      WorkspaceRuntime.switching = false;
    }
  });
  IPCMain.handle("workspaces:switch", async (event, id: string) => {
    const state = registry.read();
    if (
      !state.migrationComplete ||
      !state.profiles.some((profile) => profile.id === id)
    )
      throw Error("Unknown workspace");
    const sender = senderWindow(event);
    if (sender !== application.window)
      throw Error("Switch profiles from the workspace dashboard");
    if (WorkspaceRuntime.switching) throw Error("Workspace switch in progress");
    if (id === state.activeId) return;
    WorkspaceRuntime.switching = true;
    WorkspaceRuntime.switchInterrupted = false;
    try {
      if (!(await EditorWindow.prepareForWorkspaceSwitch()))
        throw Error("Workspace switch canceled; an editor remains open.");
      if (WorkspaceRuntime.switchInterrupted)
        throw Error("Workspace switch canceled because a file or link was opened.");
      if (
        BrowserWindow.getAllWindows().some(
          (window) => window !== sender && !window.isDestroyed(),
        )
      )
        throw Error(
          "Close preview or export windows before switching workspaces.",
        );
      registry.write({ ...state, activeId: id });
      await restartApplication();
    } catch (error) {
      WorkspaceRuntime.switching = false;
      WorkspaceRuntime.switchInterrupted = false;
      void application.resumePendingOpens();
      throw error;
    }
  });
  IPCMain.handle(
    "workspaces:migration:preview",
    (event, snapshot: WorkspaceDataSnapshot) => {
      legacy(event);
      return migration.preview(snapshot);
    },
  );
  IPCMain.handle(
    "workspaces:migration:run",
    async (event, resolutions: Record<string, string>) => {
      legacy(event);
      if (BrowserWindow.getAllWindows().length > 1)
        throw Error("Close other windows before migrating");
      await migration.run(resolutions);
      await restartApplication();
    },
  );
  IPCMain.handle("workspaces:migration:target", (event) =>
    migration.targetSnapshot(senderWindow(event)),
  );
  IPCMain.handle("workspaces:migration:verified", (event, hash: string) =>
    migration.verified(senderWindow(event), hash),
  );
}
