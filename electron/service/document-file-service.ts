import { dialog, app, type BrowserWindow } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { archiveFingerprint } from "../utilities/archive-fingerprint";
import { ConfigService } from "./config-service";
import en from "../../src/locales/en.json";
import id from "../../src/locales/id.json";

const messages = () => (ConfigService.getKey("language") === "id" ? id : en).editor.save;

interface FileTarget {
  window: BrowserWindow;
  filePath?: string;
  baseline?: string;
}

/** Native file decisions and atomic writes share one path for toolbar and close-save. */
export class DocumentFileService {
  static async revision(filePath: string): Promise<string | undefined> {
    try {
      const bytes = await fs.readFile(filePath);
      try { return archiveFingerprint(bytes); }
      catch { return `unreadable:${createHash("sha256").update(bytes).digest("hex")}`; }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
  }

  static async save(target: FileTarget, bytes: Uint8Array, fileName: string, mode: DocumentSaveMode): Promise<DocumentSaveResult> {
    let filePath = target.filePath;
    let cancelledReason: "external-change" | "source-missing" | undefined;
    try {
      let expected = filePath && mode !== "save-as" ? await this.revision(filePath) : undefined;
      const incoming = archiveFingerprint(bytes);
      if (mode === "save-as" || !filePath || expected === undefined) {
        if (mode === "save" && filePath && expected === undefined) cancelledReason = "source-missing";
        filePath = await this.choosePath(target.window, filePath, fileName,
          mode === "save" && !!filePath && expected === undefined ? messages().choose_location : messages().as);
        if (!filePath) return { status: "cancelled", ...(cancelledReason ? { reason: cancelledReason } : {}) };
        expected = await this.revision(filePath);
      } else if (expected !== target.baseline && expected !== incoming) {
        const conflict = messages().conflict;
        const { response } = await dialog.showMessageBox(target.window, {
          type: "warning", title: conflict.title, message: conflict.title,
          detail: `${conflict.description}\n\n${filePath}`,
          buttons: [conflict.copy, conflict.reload, conflict.cancel],
          defaultId: 0, cancelId: 2, noLink: true,
        });
        if (response === 1) return { status: "reload" };
        if (response !== 0) return { status: "cancelled", reason: "external-change" };
        const original = filePath;
        const extension = path.extname(original);
        const copyName = `${path.basename(original, extension)} - ${conflict.copy_suffix}${extension}`;
        filePath = await this.choosePath(target.window, path.join(path.dirname(original), copyName), copyName, conflict.copy);
        if (!filePath) return { status: "cancelled", reason: "external-change" };
        const [sourcePath, destinationPath] = await Promise.all([
          fs.realpath(original), fs.realpath(filePath).catch(() => path.resolve(filePath!)),
        ]);
        if (sourcePath === destinationPath)
          return { status: "failed", error: { code: "changed", detail: conflict.different_path, filePath } };
        expected = await this.revision(filePath);
      }

      await fs.mkdir(path.dirname(filePath), { recursive: true });
      const temporary = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${randomUUID()}.tmp`);
      try {
        await fs.writeFile(temporary, bytes, { flag: "wx" });
        if (await this.revision(filePath) !== expected)
          return { status: "failed", error: { code: "changed", detail: messages().errors.changed, filePath } };
        await fs.rename(temporary, filePath);
      } finally {
        await fs.rm(temporary, { force: true }).catch(() => {});
      }
      return { status: "saved", filePath, savedAt: Date.now() };
    } catch (error) {
      const native = error as NodeJS.ErrnoException;
      const code: DocumentSaveErrorCode = ["EACCES", "EPERM", "EROFS"].includes(native.code ?? "")
        ? "permission" : ["ENOSPC", "EDQUOT"].includes(native.code ?? "")
          ? "disk-full" : ["ENOENT", "ENOTDIR", "ENODEV"].includes(native.code ?? "")
            ? "unavailable" : "io";
      return { status: "failed", error: { code, filePath, detail: native.message ?? String(error) } };
    }
  }

  private static async choosePath(window: BrowserWindow, filePath: string | undefined, fileName: string, title: string) {
    const result = await dialog.showSaveDialog(window, {
      title,
      defaultPath: filePath ?? path.join(app.getPath("downloads"), path.basename(fileName)),
      filters: [{ name: "HighTex", extensions: ["hightex"] }],
    });
    return result.canceled ? undefined : result.filePath;
  }
}
