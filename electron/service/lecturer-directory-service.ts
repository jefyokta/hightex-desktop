import Store from "electron-store";
import { randomUUID } from "node:crypto";
import { Connection } from "../database/core/connection";
import {
  LocalLecturerDirectory,
  parseLocalLecturerEntries,
  type LocalDirectoryStorage,
} from "./lecturer-directory-client";
import { createLecturerDirectoryStorage } from "./lecturer-directory-storage";

const db = Connection.get();
let storage: LocalDirectoryStorage | undefined;

function getStorage() {
  if (storage) return storage;
  const local = createLecturerDirectoryStorage(db);
  // Migrate only user-created entries, never server/installer snapshots.
  // A marker prevents an old file from restoring deleted rows on restart.
  if (!local.hasMigrated()) {
    const previous = new Store<{ entries: unknown; snapshots?: unknown }>({
      name: "lecturer-directory",
    });
    local.migrate(parseLocalLecturerEntries(previous.get("entries")));
    previous.delete("entries");
    previous.delete("snapshots");
  }
  storage = local.storage;
  return storage;
}

// A failed migration/read surfaces in the directory UI instead of crashing startup.
export const lecturerDirectory = new LocalLecturerDirectory({
  read: () => getStorage().read(),
  save: (entry) => getStorage().save(entry),
  remove: (id) => getStorage().remove(id),
  insert: (entries) => getStorage().insert(entries),
  createId: randomUUID,
});
