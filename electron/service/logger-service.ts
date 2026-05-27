import fs from "fs";
import path from "path";
import { app } from "electron";

export class LoggerService {
  private static fileName: string;

  static write(error: any, context?: string, fileName?: string) {
    this.fileName = fileName
      ? path.join(app.getPath("userData"), "hightex-server.log")
      : this.fileName;
    try {
      const log = {
        time: new Date().toISOString(),
        context: context || "unknown",
        error: error?.message || error,
        stack: error?.stack || null,
      };

      fs.appendFileSync(this.fileName, JSON.stringify(log) + "\n");
    } catch (e) {
      console.error("Failed writing log", e);
    }
  }
}
