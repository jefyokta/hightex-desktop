import fs from "fs";
import path from "path";
import { app } from "electron";

export class LoggerService {
  static write(error: any, context?: string, fileName?: string) {
    try {
      const targetFile = fileName
        ? path.isAbsolute(fileName)
          ? fileName
          : path.join(app.getPath("userData"), fileName)
        : path.join(app.getPath("userData"), "hightex.log");

      const log = {
        time: new Date().toISOString(),
        context: context || "unknown",
        error: error?.message || error,
        stack: error?.stack || null,
      };

      fs.appendFileSync(targetFile, JSON.stringify(log) + "\n");
    } catch (e) {
      console.error("Failed writing log", e);
    }
  }
}
