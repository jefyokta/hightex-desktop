import { Snapshot as SnapshotModel } from "@main/database/models/snapshot";
import { Comment } from "@main/database/models/comment";
import { randomCode } from "@main/server/sharing-server/utils";
import { app } from "electron";
import { strToU8, Zippable, zipSync } from "fflate";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFile } from "fs";
import path from "path";

export class SnapshotService {
  static create(
    snapshot: Snapshot & {
      images: SerialableImageRecord[];
      id?: string;
      documentId: string;
      type: string;
    },
  ) {
    const id = snapshot.id || randomCode(32);

    const snapshotDir = path.join(app.getPath("userData"), "snapshots");

    mkdirSync(snapshotDir, { recursive: true });

    const filePath = path.join(snapshotDir, `${id}.htx`);

    const file = this.createFile(snapshot);
    writeFile(filePath, file, (err) => {
      if (err) {
        console.error(err);
        throw new Error("failed to write snapshot file");
      }
    });

    SnapshotModel.query().create({
      id,
      filePath,
      updatedAt: new Date().toISOString(),
      documentId: snapshot.documentId,
      type: snapshot.type,
    });
  }

  static read(filePath: string) {
    return readFileSync(filePath);
  }

  static delete(id: string) {
    const snapshot = SnapshotModel.find(id);

    if (!snapshot) return false;

    if (snapshot.filePath && existsSync(snapshot.filePath)) {
      unlinkSync(snapshot.filePath);
    }

    Comment.where("snapshotId", id).delete();
    SnapshotModel.where("id", id).delete();

    return true;
  }

  private static createFile(
    snapshot: Snapshot & { images: SerialableImageRecord[] },
  ) {
    const data = {
      "document.html": strToU8(snapshot.html),
      "style.css": strToU8(snapshot.css),
    } as Zippable;
    for (const image of snapshot.images) {
      data[`images/${image.id}.webp`] = image.buffer;
    }
    return zipSync(data);
  }
}
