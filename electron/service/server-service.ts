import Store from "electron-store";
import { LoggerService } from "./logger-service";
import { SessionService } from "./session-service";
import path from "path";
import { app } from "electron";
import "dotenv/config";
import { HttpException } from "@main/exception/http/http-exception";
import { HttpExceptionFactory } from "@main/exception/http/factory";
interface ServerInfo {
  serverHost?: string;
  serverUrl?: string;
  apiUrl?: string;
}

const configStore = new Store();
const SERVER_INFO_URL =
  "https://raw.githubusercontent.com/jefyokta/hightex-project/main/info.json";
export class ServerService {
  static setServerUrl(url: string) {
    const normalized = url.endsWith("/") ? url : url + "/";
    configStore.set("server.url", normalized);
  }

  private static getServerUrl(): string {
    // if (!app.isPackaged && process.env.DEV_MODE) {
    //   return "https://hightex.okta/api/";
    // }

    const url = configStore.get("server.url") as string | undefined;
    return url || "https://hightex.okta/api/";
  }
  static async checkForHost() {
    const response = await fetch(SERVER_INFO_URL, {
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    const info = (await response.json()) as ServerInfo;

    const host = info.apiUrl || info.serverUrl || info.serverHost;

    if (!host) {
      throw new Error("serverHost is missing from info.json");
    }
    configStore.set("server.url", host);
  }
  static async request<T = any>(
    endpoint: string,
    options: RequestInit = {},
    context?: string,
  ): Promise<T> {
    const token = SessionService.getToken();

    const headers: Record<string, string> = {
      "content-type": "application/json",
      ...((options.headers as Record<string, string>) || {}),
    };

    if (token) {
      headers.authorization = `Bearer ${token}`;
    }

    if (options.body instanceof FormData) {
      headers["content-type"] = "application/x-hightex";
    }

    const url = this.buildUrl(endpoint);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });
      if (!response.ok) {
        const errText = await response.text().catch(() => "Request failed");

        const error = new Error(`HTTP ${response.status}: ${errText}`);
        this.log(error, context || endpoint);
        throw new HttpException(response, errText);
      }
      if (
        response.headers.get("content-type")?.toLowerCase() ==
        "application/x-hightex"
      ) {
        return (await response.arrayBuffer()) as T;
      }
      const text = await response.text();
      return text ? JSON.parse(text) : ({} as T);
    } catch (error) {
      this.log(error, context || endpoint);
      // console.log(error);
      if (error instanceof HttpException) {
        throw HttpExceptionFactory.create(error);
      }
      throw error;
    }
  }

  private static buildUrl(endpoint: string): string {
    const base = this.getServerUrl();
    const target = `${base}${endpoint.replace(/^\/+/, "")}`;
    return target;
  }

  private static log(error: any, context: string) {
    LoggerService.write(error, context, this.getLogFile());
  }

  private static getLogFile(): string {
    return path.join(app.getPath("userData"), "hightex-server.log");
  }

  static checkForUpdates() {
    try {
    } catch (error) {
      LoggerService.write(
        error,
        "checking for server data updates",
        this.getLogFile(),
      );
    }
  }
  static async documentSyncRequest<T = unknown>(
    endpoint: string,
    options: RequestInit = {},
    context = "document sync",
  ): Promise<{
    ok: boolean;
    status: number;
    data: T;
    headers: Headers;
  }> {
    const headers = new Headers(options.headers);
    const token = SessionService.getToken();

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    headers.set("Accept", "application/json");

    if (options.body instanceof FormData) {
      headers.delete("Content-Type");
    } else if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    try {
      const response = await fetch(this.buildUrl(endpoint), {
        ...options,
        headers,
      });

      const contentType =
        response.headers.get("content-type")?.toLowerCase() ?? "";

      let data: unknown = {};

      if (response.status !== 204) {
        if (
          contentType.includes("application/x-hightex") ||
          contentType.includes("application/octet-stream")
        ) {
          data = new Uint8Array(await response.arrayBuffer());
        } else {
          const text = await response.text();

          if (text) {
            try {
              data = JSON.parse(text);
            } catch {
              data = text;
            }
          }
        }
      }

      if (!response.ok) {
        this.log(
          new Error(
            `HTTP ${response.status}: ${
              typeof data === "string" ? data : JSON.stringify(data)
            }`,
          ),
          context,
        );
      }

      return {
        ok: response.ok,
        status: response.status,
        data: data as T,
        headers: response.headers,
      };
    } catch (error) {
      this.log(error, context);
      throw error;
    }
  }
}
