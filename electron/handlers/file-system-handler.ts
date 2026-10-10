import { FileSystemService } from "@main/service/file-system-service";
import { IPCMain } from "@main/utilities/ipc-main";
import { app } from "electron";
import { dirname } from "path";

export class FileSystemHandler {
  static register() {
    IPCMain.handle("fs:open", async (_, filePath) => {
      return FileSystemService.openFile(filePath);
    });
    IPCMain.handle("fs:open.in_folder", async (_, filePath) => {
      return FileSystemService.openInFolder(filePath);
    });

    IPCMain.handle("fs:folder", async (_, path) => {
      return FileSystemService.openFile(dirname(path));
    });

    IPCMain.handle("fs:userData",()=>{
      return app.getPath("userData")
    })
  }
}
