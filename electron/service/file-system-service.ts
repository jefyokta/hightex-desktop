import fs from "node:fs";
import { shell } from "electron";

export class FileSystemService {
  static openFile(filePath: fs.PathLike): Promise<string> {
    return shell.openPath(filePath.toString());
  }
  static openInFolder(filePath:fs.PathLike){
    return shell.showItemInFolder(filePath.toString());
  }
  static openFolder(folder: fs.PathLike): Promise<string> {
    return shell.openPath(folder.toString());
  }
}