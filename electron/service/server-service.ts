import { LoggerService } from "./logger-service";
import { SessionService } from "./session-service";
import path from "path";
import { app } from "electron";
import { ServerUrl } from "../url/server-url";
import { HttpException } from "@main/exception/http/http-exception";
import { HttpExceptionFactory } from "@main/exception/http/factory";
export class ServerService {
  static async request<T = unknown>(
    endpoint: string,
    options: RequestInit = {},
    context?: string,
  ): Promise<T> {
    const token = SessionService.getToken();

    const headers: Record<string, string> = {
      accept: "application/json",
      "content-type": "application/json",
      ...((options.headers as Record<string, string>) || {}),
    };

    if (token) {
      headers.authorization = `Bearer ${token}`;
    }

    if (options.body instanceof FormData) {
      headers["content-type"] = "application/x-hightex";
    }

    const url = ServerUrl.instance.endpoint(endpoint);

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

  private static log(error: unknown, context: string) {
    LoggerService.write(error, context, this.getLogFile());
  }

  private static getLogFile(): string {
    return path.join(app.getPath("userData"), "hightex-server.log");
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
      const response = await fetch(ServerUrl.instance.endpoint(endpoint), {
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
      console.log(data);
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
