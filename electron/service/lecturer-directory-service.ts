import Store from "electron-store";
import { randomUUID } from "node:crypto";
import { Connection } from "../database/core/connection";
import { LocalLecturer } from "../database/models/lecturer";
import {
  LocalLecturerDirectory,
  parseLocalLecturerEntries,
  type LocalDirectoryStorage,
} from "../directory/lecturer-directory";
import { LecturerCloudClient } from "../clients/lecturer-cloud-client";
import { requestCloudLecturers } from "../transports/lecturer-cloud-transport";
import { documentService } from "./document-service";
import { SessionService } from "./session-service";
import { SessionHandler } from "../handlers/session-handlers";
import { desktopAuth } from "./auth-service";

const db = Connection.get();
let storage: LocalDirectoryStorage | undefined;
let localLecturers: LocalLecturer | undefined;

function toEntity(
  entry: LecturerDirectoryEntry,
): Omit<LecturerEntity, "createdAt"> {
  const source = entry.source ?? { type: "unknown" as const };
  return {
    id: entry.id,
    name: entry.name,
    nip: entry.nip,
    source_type: source.type,
    source_detail:
      source.type === "cloud"
        ? source.url
        : source.type === "file"
          ? (source.filename ?? null)
          : null,
  };
}

function fromEntity(row: LecturerEntity): LecturerDirectoryEntry {
  return {
    id: row.id,
    name: row.name,
    nip: row.nip,
    source:
      row.source_type === "cloud"
        ? { type: "cloud", url: row.source_detail ?? "" }
        : row.source_type === "file"
          ? {
              type: "file",
              ...(row.source_detail ? { filename: row.source_detail } : {}),
            }
          : ({ type: row.source_type } as LecturerSource),
  };
}

function getModel() {
  if (localLecturers) return localLecturers;
  const model = new LocalLecturer(db);
  model.boot();
  localLecturers = model;
  return localLecturers;
}

function getStorage() {
  if (storage) return storage;
  const model = getModel();
  // Migrate only user-created entries, never server/installer snapshots.
  // The store marker and insert-ignore transaction make interrupted upgrades safe.
  const previous = new Store<{
    entries: unknown;
    snapshots?: unknown;
    "entries-migrated"?: boolean;
  }>({ name: "lecturer-directory" });
  if (!previous.get("entries-migrated", false)) {
    const entries = parseLocalLecturerEntries(previous.get("entries"));
    db.transaction(() => {
      for (const entry of entries) model.create(toEntity(entry), "IGNORE");
    })();
    previous.set("entries-migrated", true);
  }
  previous.delete("entries");
  previous.delete("snapshots");
  storage = {
    read: () => model.orderBy("rowid", "ASC").get().map(fromEntity),
    save: (entry) => {
      const row = toEntity(entry);
      const { id, ...fields } = row;
      if (model.find(id)) model.where("id", id).update(fields);
      else model.create(row);
    },
    remove: (id) => {
      model.where("id", id).delete();
    },
    insert: (entries) => {
      db.transaction(() => {
        for (const entry of entries) model.create(toEntity(entry));
      })();
    },
    createId: randomUUID,
  };
  return storage;
}

// A failed migration/read surfaces in the directory UI instead of crashing startup.
export const lecturerDirectory = new LocalLecturerDirectory({
  read: () => getStorage().read(),
  save: (entry) => getStorage().save(entry),
  remove: (id) => getStorage().remove(id),
  insert: (entries) => getStorage().insert(entries),
  createId: () => getStorage().createId(),
});

export const lecturerCloud = new LecturerCloudClient(lecturerDirectory, {
  session: () => {
    const token = SessionService.getToken();
    if (!token || !SessionService.getUser()) return null;
    return { ...documentService.context(), token };
  },
  request: requestCloudLecturers,
  unauthenticated: () => {
    desktopAuth.cancel();
    SessionService.clear();
    void SessionHandler.broadcastSession();
  },
});
