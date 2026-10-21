import { AuthRouter } from "./auth";
import { AppHost } from "./app";
import { Router } from "./contract";

export class Controller {
  private static hosts: Record<string, Router> = {
    app: new AppHost(),
    auth: new AuthRouter(),
  };

  static handle(url: URL) {
    const { host } = url;
    const handler = this.hosts[host];
    if (url.protocol !== "hightex:" || !handler) {
      return new Response("Not Found", { status: 404 });
    }
    return handler.handle(url);
  }
}
