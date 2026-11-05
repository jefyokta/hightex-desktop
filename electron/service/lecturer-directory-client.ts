import {
  MAX_LECTURERS,
  parseLecturerImport,
  parseLecturerPerson,
} from "../../src/utils/lecturer-import";
import { parseLecturerSource } from "../../src/utils/lecturer-source";

export interface LocalDirectoryStorage {
  read(): unknown;
  save(entry: LecturerDirectoryEntry): void;
  remove(id: string): void;
  insert(entries: LecturerDirectoryEntry[]): void;
  createId(): string;
}

const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Invalid lecturer");
  return value as Record<string, unknown>;
};

export function parseLocalLecturerEntries(
  raw: unknown,
): LecturerDirectoryEntry[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.length > MAX_LECTURERS)
    throw Error("Invalid directory");
  const ids = new Set<string>();
  return raw.map((value) => {
    const row = record(value);
    if (
      typeof row.id !== "string" ||
      !row.id.startsWith("local:") ||
      row.id.length <= 6 ||
      row.id.length > 200 ||
      ids.has(row.id) ||
      typeof row.nip !== "string"
    )
      throw Error("Invalid lecturer");
    ids.add(row.id);
    return {
      id: row.id,
      ...parseLecturerPerson(row, true),
      source: parseLecturerSource(row.source),
    };
  });
}

/** Local entries persist independently of login and never ship in the installer. */
export class LocalLecturerDirectory {
  constructor(private storage: LocalDirectoryStorage) {}

  private state(data: LecturerDirectoryEntry[]): LecturerDirectoryState {
    return {
      data,
    };
  }

  private entries() {
    return parseLocalLecturerEntries(this.storage.read());
  }

  list(): LecturerDirectoryState {
    try {
      return this.state(this.entries());
    } catch {
      return { ...this.state([]), error: "storage" };
    }
  }

  save(input: unknown) {
    const row = record(input);
    const value = parseLecturerPerson(row);
    const data = this.entries();
    let index = -1;
    if (row.id !== undefined) {
      if (typeof row.id !== "string") throw Error("Invalid lecturer ID");
      index = data.findIndex((entry) => entry.id === row.id);
      if (index < 0) throw Error("Lecturer not found");
    } else if (data.length >= MAX_LECTURERS) throw Error("Directory is full");
    const entry = {
      id: index < 0 ? `local:${this.storage.createId()}` : data[index].id,
      ...value,
      // Provenance is assigned by the ingestion flow, never chosen in a form.
      source: index < 0 ? { type: "manual" as const } : data[index].source,
    };
    this.storage.save(entry);
    if (index < 0) data.push(entry);
    else data[index] = entry;
    return { entry, ...this.state(data) };
  }

  remove(id: unknown): LecturerDirectoryState {
    if (typeof id !== "string") throw Error("Invalid lecturer ID");
    const data = this.entries().filter((entry) => entry.id !== id);
    this.storage.remove(id);
    return this.state(data);
  }

  import(input: unknown, filename?: unknown): LecturerDirectoryImportResult {
    const rows = parseLecturerImport(input);
    const source = parseLecturerSource({
      type: "file",
      ...(filename === undefined ? {} : { filename }),
    });
    return this.append(rows, source);
  }

  /** Called by the authenticated main-process fetch flow, never with a renderer URL. */
  importCloud(rows: { name: string; nip: string }[], url: string) {
    const source = parseLecturerSource({ type: "cloud", url });
    return this.append(
      rows.map((row) => parseLecturerPerson(row)),
      source,
    );
  }

  private append(
    rows: { name: string; nip: string }[],
    source: LecturerSource,
  ): LecturerDirectoryImportResult {
    const data = this.entries();
    const nips = new Set(data.filter((row) => row.nip).map((row) => row.nip));
    const added: LecturerDirectoryEntry[] = [];
    for (const row of rows) {
      if (nips.has(row.nip)) continue;
      nips.add(row.nip);
      added.push({ id: `local:${this.storage.createId()}`, ...row, source });
    }
    if (data.length + added.length > MAX_LECTURERS)
      throw Error("Directory is full");
    if (added.length) this.storage.insert(added);
    return {
      ...this.state([...data, ...added]),
      added: added.length,
      skipped: rows.length - added.length,
    };
  }
}
