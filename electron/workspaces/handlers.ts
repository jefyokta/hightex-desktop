import { app, BrowserWindow } from "electron";
import type { Application } from "../main/application";
import { IPCMain } from "../utilities/ipc-main";
import { WorkspaceRuntime } from "./runtime";
import { WorkspaceRegistry } from "./registry";
import { WorkspaceMigration } from "./migration";

export function registerWorkspaceHandlers(application: Application) {
  if (!WorkspaceRuntime.root) return;
  const registry = new WorkspaceRegistry(WorkspaceRuntime.root);
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
  const restart = () => {
    app.relaunch();
    app.quit();
  };
  IPCMain.handle("workspaces:state", () => registry.read());
  IPCMain.handle("workspaces:create", (_, input) => registry.create(input));
  IPCMain.handle("workspaces:switch", (event, id: string) => {
    const state = registry.read();
    if (
      !state.migrationComplete ||
      !state.profiles.some((profile) => profile.id === id)
    )
      throw Error("Unknown workspace");
    const sender = senderWindow(event);
    if (sender !== application.window)
      throw Error("Switch profiles from the workspace dashboard");
    // Switching restarts all service singletons. Let existing close guards resolve first.
    if (
      BrowserWindow.getAllWindows().some(
        (window) => window !== sender && !window.isDestroyed(),
      )
    )
      throw Error(
        "Close editor, preview, and sharing windows before switching profiles.",
      );
    registry.write({ ...state, activeId: id });
    restart();
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
      restart();
    },
  );
  IPCMain.handle("workspaces:migration:target", (event) =>
    migration.targetSnapshot(senderWindow(event)),
  );
  IPCMain.handle("workspaces:migration:verified", (event, hash: string) =>
    migration.verified(senderWindow(event), hash),
  );
}
