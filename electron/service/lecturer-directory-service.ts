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

import {
  lecturerToEntity,
  lecturerFromEntity,
} from "../directory/lecturer-record";

const db = Connection.get();
let storage: LocalDirectoryStorage | undefined;
let localLecturers: LocalLecturer | undefined;

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
      for (const entry of entries)
        model.create(lecturerToEntity(entry), "IGNORE");
    })();
    previous.set("entries-migrated", true);
  }
  previous.delete("entries");
  previous.delete("snapshots");
  const save = (entry: LecturerDirectoryEntry) => {
    const { id, ...fields } = lecturerToEntity(entry);
    if (model.find(id)) model.where("id", id).update(fields);
    else model.create({ id, ...fields });
  };
  storage = {
    read: () => model.orderBy("rowid", "ASC").get().map(lecturerFromEntity),
    save,
    remove: (id) => {
      model.where("id", id).delete();
    },
    upsert: (entries) => {
      db.transaction(() => {
        entries.forEach(save);
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
  upsert: (entries) => getStorage().upsert(entries),
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
