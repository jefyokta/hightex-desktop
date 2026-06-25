import { Snapshot } from "@main/database/models/snapshot";
import { SnapshotService } from "@main/service/snapshot-service";
import { ipcMain } from "electron";

export class SnapshotHandler {
  static register() {
    ipcMain.handle("snapshots", () => {
      return Snapshot.all();
    });

    ipcMain.handle("snapshot", (_, id: string) => {
      return Snapshot.with("comments", (query) => {
        query.select("*");
      }).find(id);
    });

    ipcMain.handle("snapshot:view", (_, id: string) => {
      const snapshot = Snapshot.find(id);

      if (!snapshot) return undefined;

      return SnapshotService.read(snapshot.filePath);
    });

    ipcMain.handle("snapshot:delete", (_, id: string) => {
      return SnapshotService.delete(id);
    });
  }
}
