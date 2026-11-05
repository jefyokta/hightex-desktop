import type { Database } from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type { LocalDirectoryStorage } from "./lecturer-directory-client";

function values(entry: LecturerDirectoryEntry) {
  const source = entry.source ?? { type: "unknown" };
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

/** Use the existing local database; import and schema migrations are atomic. */
export function createLecturerDirectoryStorage(db: Database) {
  db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS local_lecturers (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        nip TEXT NOT NULL DEFAULT '',
        source_type TEXT NOT NULL DEFAULT 'unknown',
        source_detail TEXT
      );
      CREATE INDEX IF NOT EXISTS local_lecturers_name ON local_lecturers(name);
      CREATE INDEX IF NOT EXISTS local_lecturers_nip ON local_lecturers(nip);
      CREATE TABLE IF NOT EXISTS local_lecturer_metadata (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `);
    const columns = db.prepare("PRAGMA table_info(local_lecturers)").all() as {
      name: string;
    }[];
    if (!columns.some((column) => column.name === "source_type"))
      db.exec(
        "ALTER TABLE local_lecturers ADD COLUMN source_type TEXT NOT NULL DEFAULT 'unknown'",
      );
    if (!columns.some((column) => column.name === "source_detail"))
      db.exec("ALTER TABLE local_lecturers ADD COLUMN source_detail TEXT");
  })();
  const sql =
    "INSERT INTO local_lecturers (id, name, nip, source_type, source_detail) VALUES (@id, @name, @nip, @source_type, @source_detail)";
  const insert = db.prepare(sql);
  const insertMany = db.transaction((entries: LecturerDirectoryEntry[]) => {
    for (const entry of entries) insert.run(values(entry));
  });
  const upsert = db.prepare(
    sql +
      " ON CONFLICT(id) DO UPDATE SET name = excluded.name, nip = excluded.nip, source_type = excluded.source_type, source_detail = excluded.source_detail",
  );
  const storage: LocalDirectoryStorage = {
    read: () => {
      const rows = db
        .prepare(
          "SELECT id, name, nip, source_type, source_detail FROM local_lecturers ORDER BY rowid",
        )
        .all() as {
        id: string;
        name: string;
        nip: string;
        source_type: string;
        source_detail: string | null;
      }[];
      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        nip: row.nip,
        source:
          row.source_type === "cloud"
            ? { type: "cloud", url: row.source_detail }
            : row.source_type === "file"
              ? {
                  type: "file",
                  ...(row.source_detail ? { filename: row.source_detail } : {}),
                }
              : { type: row.source_type },
      }));
    },
    save: (entry) => {
      upsert.run(values(entry));
    },
    remove: (id) => {
      db.prepare("DELETE FROM local_lecturers WHERE id = ?").run(id);
    },
    insert: (entries) => {
      insertMany(entries);
    },
    createId: randomUUID,
  };
  return {
    storage,
    hasMigrated: () =>
      !!db
        .prepare(
          "SELECT 1 FROM local_lecturer_metadata WHERE key = 'legacy-json'",
        )
        .get(),
    migrate: db.transaction((entries: LecturerDirectoryEntry[]) => {
      const insertLegacy = db.prepare(
        sql.replace("INSERT INTO", "INSERT OR IGNORE INTO"),
      );
      for (const entry of entries) insertLegacy.run(values(entry));
      db.prepare(
        "INSERT OR IGNORE INTO local_lecturer_metadata (key, value) VALUES ('legacy-json', '1')",
      ).run();
    }),
  };
}
