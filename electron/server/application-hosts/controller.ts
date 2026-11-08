import { AuthRouter } from "./auth";
import { AppHost } from "./app";
import { Router } from "./contract";
import { DocumentRouter } from "./document";
import { workspaceIdFromUrl } from "../../../src/workspaces/identity";
import { WorkspaceRuntime } from "../../workspaces/runtime";
import { WorkspaceRegistry } from "../../workspaces/registry";

export class Controller {
  private static hosts: Record<string, Router> = {
    app: new AppHost(),
    auth: new AuthRouter(),
    document: new DocumentRouter(),
  };

  static handle(url: URL) {
    const { host } = url;
    const profileId = workspaceIdFromUrl(url);
    const knownProfile =
      profileId &&
      WorkspaceRuntime.root &&
      new WorkspaceRegistry(WorkspaceRuntime.root)
        .read()
        .profiles.some((profile) => profile.id === profileId);
    const handler = knownProfile ? this.hosts.app : this.hosts[host];
    if (url.protocol !== "hightex:" || !handler) {
      return new Response("Not Found", { status: 404 });
    }
    return handler.handle(url);
  }
}
