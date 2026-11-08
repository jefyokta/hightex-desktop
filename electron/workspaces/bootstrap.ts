import { app, protocol } from "electron";
import { mkdirSync } from "node:fs";
import { WorkspaceRegistry } from "./registry";
import { WorkspaceRuntime } from "./runtime";
import { ServerUrl } from "../url/server-url";

export function initializeWorkspace() {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: "hightex",
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
      },
    },
  ]);
  WorkspaceRuntime.protocolRegistered = true;
  const root = app.getPath("userData");
  const cloudServerUrl = new ServerUrl().api.href;
  WorkspaceRuntime.serverUrl = cloudServerUrl;
  const registry = new WorkspaceRegistry(root, cloudServerUrl);
  const state = registry.read();
  WorkspaceRuntime.root = root;
  WorkspaceRuntime.migrating = !state.migrationComplete;
  WorkspaceRuntime.profile = state.profiles.find(
    (profile) => profile.id === state.activeId,
  );
  // Browser data stays at the original location; origins isolate each workspace.
  app.setPath("sessionData", root);
  if (state.migrationComplete) {
    const directory = registry.directory(state.activeId);
    mkdirSync(directory, { recursive: true });
    app.setPath("userData", directory);
  }
}
