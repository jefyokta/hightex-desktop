import { AppHost } from "./app";
import { Router } from "./contract";

export class Controller {
  private static hosts: Record<string, Router> = {
    app: new AppHost(),
  };

 static handle(url: URL) {
    const { host } = url;
    const handler = this.hosts[host];
    if (!host) {
      return new Response("Not Found", { status: 404 });
    }
    return handler.handle(url);
  }
}
