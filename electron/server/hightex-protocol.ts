import { protocol } from "electron";
import { LoggerService } from "@main/service/logger-service";
import { Controller } from "./application-hosts/controller";
import { WorkspaceRuntime } from "../workspaces/runtime";
import { workspaceHost } from "../../src/workspaces/identity";

export class HightexProtocol {
  static readonly SCHEME = "hightex";
  static readonly HOST = "app";

  private started = false;

  static registerSchemesAsPrivileged() {
    if (WorkspaceRuntime.protocolRegistered) return;
    protocol.registerSchemesAsPrivileged([
      {
        scheme: HightexProtocol.SCHEME,
        privileges: {
          standard: true,
          secure: true,
          supportFetchAPI: true,
          corsEnabled: true,
        },
      },
    ]);
    WorkspaceRuntime.protocolRegistered = true;
  }

  public get url() {
    const profile = WorkspaceRuntime.profile;
    const host =
      profile && !WorkspaceRuntime.migrating
        ? workspaceHost(profile.id)
        : HightexProtocol.HOST;
    return `${HightexProtocol.SCHEME}://${host}`;
  }

  public start() {
    if (this.started) {
      return;
    }

    this.started = true;

    protocol.handle(HightexProtocol.SCHEME, async (req) => {
      try {
        const url = new URL(req.url);
        return await Controller.handle(url);
      } catch (error) {
        LoggerService.write(error, "hightex-protocol");
        return new Response("Internal Server Error", { status: 500 });
      }
    });
  }

  public stop() {
    if (!this.started) {
      return;
    }

    protocol.unhandle(HightexProtocol.SCHEME);
    this.started = false;
  }
}
