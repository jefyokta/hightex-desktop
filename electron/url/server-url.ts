import { ApplicationRuntime } from "../main/application-runtime";
import "dotenv/config";

export class ServerUrl {
  public readonly url: URL;
  private static _instance?: ServerUrl;

  constructor(base?: string | URL) {
    this.url = new URL(
      base ??
        (ApplicationRuntime.isDev
          ? process.env["LOCAL_SERVER"] || "http://127.0.0.1:8000"
          : "https://hightex.jefyokta.dev"),
    );
    if (
      !["http:", "https:"].includes(this.url.protocol) ||
      this.url.username ||
      this.url.password
    ) {
      throw new Error("Invalid server URL");
    }
  }

  public static get instance(): ServerUrl {
    return (this._instance ??= new ServerUrl());
  }

  /**
   * Determine whether a URL has the same origin as the configured server.
   */
  public compare(input: string | URL): boolean {
    const url = input instanceof URL ? input : new URL(input);
    return url.origin === this.url.origin;
  }

  /**
   * API base URL, e.g. https://example.com/api/
   */
  public get api(): URL {
    return new URL("/api/", this.url.origin);
  }

  /** Resolve an API endpoint without dropping the /api/ prefix. */
  public endpoint(path: string): URL {
    const url = new URL(path.replace(/^\/+/, ""), this.api);
    if (
      !this.compare(url) ||
      url.username ||
      url.password ||
      !url.pathname.startsWith(this.api.pathname)
    ) {
      throw new Error("Invalid server API endpoint");
    }
    return url;
  }

  /** Resolve a website or storage path on this server. */
  public resolve(path: string | URL = "/"): URL {
    const url = new URL(path, this.url.origin + "/");
    if (!this.compare(url) || url.username || url.password) {
      throw new Error("Invalid server URL");
    }
    return url;
  }
}
