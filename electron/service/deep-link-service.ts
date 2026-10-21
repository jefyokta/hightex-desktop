import { BrowserWindow } from "electron";
import { Controller } from "@main/server/application-hosts/controller";
import { HightexProtocol } from "@main/server/hightex-protocol";

export class DeepLinkService {
  private url: URL;
  constructor(url: string | URL) {
    this.url = new URL(url);
  }
  /**
   *
   * @platfrom "windows"|"linux"
   */
  static isDeepLink(args: string[]) {
    const url = args.find((a) => a.startsWith(HightexProtocol.SCHEME + "://"));
    if (!url) {
      return undefined;
    }
    try {
      return new DeepLinkService(url);
    } catch {
      return undefined;
    }
  }

  toString() {
    return this.url.toString();
  }
  async handle() {
    const response = await Controller.handle(this.url);
    if (this.url.hostname === "auth") {
      const windows = BrowserWindow.getAllWindows().filter(
        (win) => !win.isDestroyed(),
      );
      const win = windows.find((win) => win.isVisible()) ?? windows[0];
      if (win?.isMinimized()) win.restore();
      win?.show();
      win?.focus();
    }
    return response;
  }
}
