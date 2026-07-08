import { Snapshot } from "@main/database/models/snapshot";
import { SnapshotService } from "@main/service/snapshot-service";
import { IPCMain } from "@main/utilities/ipc-main";

export class SnapshotHandler {
  static register() {
    IPCMain.handle("snapshots", () => {
      return Snapshot.all();
    });

    IPCMain.handle("snapshot", (_, id: string) => {
      return Snapshot.with("comments", (query) => {
        query.select("*");
      }).find(id);
    });

    IPCMain.handle("snapshot:view", (_, id: string) => {
      const snapshot = Snapshot.find(id);

      if (!snapshot) return undefined;

      return SnapshotService.read(snapshot.filePath);
    });

    IPCMain.handle("snapshot:delete", (_, id: string) => {
      return SnapshotService.delete(id);
    });
  }
}
