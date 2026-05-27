import Store from "electron-store";
import { LoggerService } from "./logger-service";
import { SessionService } from "./session-service";
import path from "path";
import { app } from "electron";

const configStore = new Store();

export class ServerService {
  static setServerUrl(url: string) {
    const normalized = url.endsWith("/") ? url : url + "/";
    configStore.set("server.url", normalized);
  }

  private static getServerUrl(): string {
    const url = configStore.get("server.url") as string | undefined;
    return url || "https://hightex.okta/api/";
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
        throw error;
      }

      const text = await response.text();
      return text ? JSON.parse(text) : ({} as T);
    } catch (error) {
      this.log(error, context || endpoint);
      throw error;
    }
  }

  private static buildUrl(endpoint: string): string {
    const base = this.getServerUrl();
    return `${base}${endpoint.replace(/^\/+/, "")}`;
  }

  private static log(error: any, context: string) {
    LoggerService.write(error, context, this.getLogFile());
  }

  private static getLogFile(): string {
    return path.join(app.getPath("userData"), "hightex-server.log");
  }
}
