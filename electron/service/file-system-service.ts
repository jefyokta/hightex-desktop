import fs from "node:fs";
import { shell } from "electron";

export class FileSystemService {
  static openExternal(url: string): Promise<void> {
    const target = new URL(url);
    if (target.protocol !== "https:")
      throw new Error("Only HTTPS links are supported");
    return shell.openExternal(target.href);
  }
  static openFile(filePath: fs.PathLike): Promise<string> {
    return shell.openPath(filePath.toString());
  }
  static openInFolder(filePath: fs.PathLike) {
    return shell.showItemInFolder(filePath.toString());
  }
  static openFolder(folder: fs.PathLike): Promise<string> {
    return shell.openPath(folder.toString());
  }
}
