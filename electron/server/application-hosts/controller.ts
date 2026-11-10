import { AuthRouter } from "./auth";
import { AppHost } from "./app";
import { Router } from "./contract";
import { DocumentRouter } from "./document";
import { workspaceHost, workspaceIdFromUrl } from "../../workspaces/identity";
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
    if (
      url.protocol === "hightex:" &&
      host === "app" &&
      !WorkspaceRuntime.migrating &&
      WorkspaceRuntime.profile
    ) {
      const destination = new URL(
        `${url.pathname}${url.search}${url.hash}`,
        `hightex://${workspaceHost(WorkspaceRuntime.profile.id)}`,
      );
      return new Response(null, {
        status: 302,
        headers: { Location: destination.href },
      });
    }
    const profileId = workspaceIdFromUrl(url);
    const knownProfile =
      profileId &&
      WorkspaceRuntime.root &&
      WorkspaceRuntime.serverUrl &&
      new WorkspaceRegistry(WorkspaceRuntime.root, WorkspaceRuntime.serverUrl)
        .read()
        .profiles.some((profile) => profile.id === profileId);
    const handler = knownProfile ? this.hosts.app : this.hosts[host];
    if (url.protocol !== "hightex:" || !handler) {
      return new Response("Not Found", { status: 404 });
    }
    return handler.handle(url);
  }
}
