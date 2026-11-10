import { Handled } from "@main/exception/interface/handled";
import { ipcMain, IpcMainInvokeEvent } from "electron";
import { WorkspaceRuntime } from "../workspaces/runtime";
import { workspaceHost, workspaceIdFromUrl } from "../workspaces/identity";

export class IPCMain {
  static handle(
    channel: string,
    // Existing channels validate and type their own payloads.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    listener: (event: IpcMainInvokeEvent, ...args: any[]) => unknown,
  ) {
    ipcMain.handle(channel, async (event, ...args) => {
      try {
        if (WorkspaceRuntime.profile) {
          const url = new URL(event.senderFrame?.url ?? "about:blank");
          const active =
            !WorkspaceRuntime.migrating &&
            workspaceIdFromUrl(url) === WorkspaceRuntime.profile.id;
          const staging =
            WorkspaceRuntime.migrating &&
            (channel.startsWith("workspaces:migration:") ||
              (channel === "config:get" &&
                workspaceIdFromUrl(url) !== null &&
                url.pathname === "/profiles/migration/target"));
          const legacyOrigin =
            (url.protocol === "hightex:" && url.host === "app") ||
            (!!process.env.VITE_DEV_SERVER_URL &&
              url.origin === new URL(process.env.VITE_DEV_SERVER_URL).origin);
          const legacy =
            WorkspaceRuntime.migrating &&
            legacyOrigin &&
            ["config:get", "workspaces:state"].includes(channel) &&
            url.pathname === "/profiles/migration";
          if (!active && !staging && !legacy)
            throw Error(
              `Workspace context does not match ${workspaceHost(WorkspaceRuntime.profile.id)}`,
            );
        }
        return await listener(event, ...args);
      } catch (error) {
        if (error instanceof Handled) {
          error.handle();
        }

        throw error;
      }
    });
  }
}
