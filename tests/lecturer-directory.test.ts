import { expect, test } from "bun:test";
import {
  LocalLecturerDirectory,
  parseLocalLecturerEntries,
} from "../electron/directory/lecturer-directory";
import {
  MAX_LECTURERS,
  parseLecturerImport,
} from "../src/utils/lecturer-import";
import { parseLecturerSource } from "../src/utils/lecturer-source";

function fixture(initial?: unknown) {
  let saved = structuredClone(initial);
  let serial = 0;
  let failWrite = false;
  const commit = (
    update: (data: LecturerDirectoryEntry[]) => LecturerDirectoryEntry[],
  ) => {
    if (failWrite) throw Error("Disk unavailable");
    saved = structuredClone(update((saved ?? []) as LecturerDirectoryEntry[]));
  };
  const storage = {
    read: () => structuredClone(saved),
    save: (entry: LecturerDirectoryEntry) =>
      commit((data) => [...data.filter((row) => row.id !== entry.id), entry]),
    remove: (id: string) =>
      commit((data) => data.filter((row) => row.id !== id)),
    insert: (entries: LecturerDirectoryEntry[]) =>
      commit((data) => [...data, ...entries]),
    createId: () => String(++serial),
  };
  return {
    client: new LocalLecturerDirectory(storage),
    restart: () => new LocalLecturerDirectory(storage),
    saved: () => structuredClone(saved),
    failWrites: () => {
      failWrite = true;
    },
  };
}

test("a fresh directory is empty and never exposes a database path", () => {
  const f = fixture();
  expect(f.client.list()).toEqual({ data: [] });
  expect(f.saved()).toBeUndefined();
  expect(f.client.list()).not.toHaveProperty("storagePath");
});

test("manual entries persist with required literal NIPs and manual provenance", () => {
  const f = fixture();
  const result = f.client.save({
    name: " Lecturer Alpha, M.Kom. ",
    nip: " 000123 ",
  });
  expect(result.entry).toEqual({
    id: "local:1",
    name: "Lecturer Alpha, M.Kom.",
    nip: "000123",
    source: { type: "manual" },
  });
  expect(f.restart().list().data).toEqual([result.entry]);
});

test("missing, blank, numeric, and oversized NIPs are rejected without changing saved data", () => {
  const f = fixture();
  f.client.save({ name: "Existing", nip: "001" });
  const previous = f.saved();
  for (const input of [
    null,
    [],
    {},
    { name: " ", nip: "1" },
    { name: "X" },
    { name: "X", nip: "" },
    { name: "X", nip: "   " },
    { name: "X", nip: 123 },
    { name: "X".repeat(501), nip: "1" },
    { name: "X", nip: "0".repeat(201) },
    { id: "12", name: "X", nip: "1" },
    { id: false, name: "X", nip: "1" },
    { id: "local:missing", name: "X", nip: "1" },
  ]) {
    expect(() => f.client.save(input)).toThrow();
    expect(f.saved()).toEqual(previous);
  }
});

test("manual editing preserves provenance and recorded document snapshots", () => {
  const f = fixture();
  const selected = f.client.import(
    [{ name: "Original", nip: "001" }],
    "faculty.json",
  ).data[0];
  const document = { advisorName: selected.name, advisorNip: selected.nip };
  const changed = f.client.save({
    id: selected.id,
    name: "Corrected",
    nip: "002",
  }).entry;
  expect(changed.source).toEqual({ type: "file", filename: "faculty.json" });
  expect(selected.name).toBe("Original");
  expect(document).toEqual({ advisorName: "Original", advisorNip: "001" });
  expect(
    f.client.save({ ...changed, source: { type: "manual" } }).entry.source,
  ).toEqual({ type: "file", filename: "faculty.json" });
});

test("manual creation cannot choose or forge its source", () => {
  const f = fixture();
  for (const source of [
    { type: "cloud", url: "https://faculty.example/" },
    { type: "file", filename: "forged.json" },
  ]) {
    expect(
      f.client.save({ name: "Manual Lecturer", nip: "001", source }).entry
        .source,
    ).toEqual({ type: "manual" });
  }
});

test("existing cloud provenance is retained and must have a safe URL", () => {
  const entry = {
    id: "local:cloud",
    name: "Cloud Lecturer",
    nip: "001",
    source: { type: "cloud" as const, url: "https://faculty.example/dosen/1" },
  };
  const f = fixture([entry]);
  expect(f.restart().list().data[0].source).toEqual({
    type: "cloud",
    url: "https://faculty.example/dosen/1",
  });
  for (const url of [
    "",
    "not-a-url",
    "javascript:alert(1)",
    "file:///tmp/private",
    "https://user:secret@example.test",
  ]) {
    expect(() => parseLecturerSource({ type: "cloud", url })).toThrow();
  }
  expect(f.restart().list().data).toEqual([entry]);
});

test("legacy entries with missing NIPs remain readable without inventing their source", () => {
  const legacy = { id: "local:old", name: "Old lecturer", nip: "" };
  const f = fixture([legacy]);
  expect(f.client.list().data).toEqual([
    { ...legacy, source: { type: "unknown" } },
  ]);
  expect(() => f.client.save({ ...legacy, name: "Edited" })).toThrow();
  expect(f.client.save({ ...legacy, nip: "000123" }).entry.source.type).toBe(
    "unknown",
  );
});

test("deleting the last row persists empty and cannot mutate an existing profile", () => {
  const f = fixture();
  const a = f.client.save({ name: "Alpha", nip: "001" }).entry;
  const b = f.client.save({ name: "Beta", nip: "002" }).entry;
  expect(f.client.remove(a.id).data).toEqual([b]);
  f.client.remove(b.id);
  expect(f.restart().list()).toEqual({ data: [] });
  expect(a.nip).toBe("001");
});

test("unrelated private fields are discarded while allowed provenance fields are retained", () => {
  const f = fixture();
  const { entry } = f.client.save({
    name: "Alpha",
    nip: "001",
    email: "private@example.test",
    token: "secret",
  });
  expect(Object.keys(entry).sort()).toEqual(["id", "name", "nip", "source"]);
  expect(f.saved()).toEqual([entry]);
  expect(
    parseLecturerSource({
      type: "file",
      filename: "/private/data/faculty.json",
    }),
  ).toEqual({ type: "file", filename: "faculty.json" });
});

test("corrupt storage and old server snapshots are not silently replaced or imported", () => {
  for (const initial of [
    null,
    {},
    {
      snapshots: {
        server: { data: [{ id: "12", name: "Server", nip: "123" }] },
      },
    },
    [{ id: "12", name: "Server", nip: "123" }],
    [
      { id: "local:1", name: "Valid", nip: "1" },
      { id: "local:1", name: "Duplicate", nip: "1" },
    ],
    [
      {
        id: "local:1",
        name: "Bad source",
        nip: "1",
        source: { type: "cloud", url: "javascript:alert(1)" },
      },
    ],
  ]) {
    const f = fixture(initial);
    expect(f.client.list().error).toBe("storage");
    expect(() => f.client.save({ name: "New", nip: "001" })).toThrow();
    expect(() => f.client.remove("local:1")).toThrow();
    expect(f.saved()).toEqual(initial);
  }
  expect(() =>
    parseLocalLecturerEntries([{ id: "local:", name: "X", nip: "1" }]),
  ).toThrow();
});

test("failed writes preserve the saved directory and its source metadata", () => {
  const f = fixture();
  const entry = f.client.save({ name: "Alpha", nip: "001" }).entry;
  const before = f.saved();
  f.failWrites();
  expect(() =>
    f.client.save({ id: entry.id, name: "Changed", nip: "999" }),
  ).toThrow();
  expect(() => f.client.remove(entry.id)).toThrow();
  expect(() =>
    f.client.import([{ name: "New", nip: "003" }], "faculty.json"),
  ).toThrow();
  expect(f.restart().list().data).toEqual(before as LecturerDirectoryEntry[]);
});

test("imports record the actual filename and ignore IDs or source claims inside the file", () => {
  const f = fixture();
  const result = f.client.import(
    {
      data: [
        {
          id: "12",
          name: " Lecturer Alpha ",
          nip: "000123",
          email: "private@example.test",
          source: { type: "cloud", url: "https://forged.example/" },
        },
        { name: "Lecturer Beta", nip: "000456" },
      ],
    },
    "faculty.json",
  );
  expect(result.added).toBe(2);
  expect(result.skipped).toBe(0);
  expect(result.data).toEqual([
    {
      id: "local:1",
      name: "Lecturer Alpha",
      nip: "000123",
      source: { type: "file", filename: "faculty.json" },
    },
    {
      id: "local:2",
      name: "Lecturer Beta",
      nip: "000456",
      source: { type: "file", filename: "faculty.json" },
    },
  ]);
  expect(f.restart().list().data).toEqual(result.data);
});

test("duplicate imports cannot overwrite local corrections or their provenance", () => {
  const f = fixture();
  f.client.save({ name: "Local corrected name", nip: "000123" });
  const result = f.client.import(
    [
      { name: "Old imported name", nip: "000123" },
      { name: "New lecturer", nip: "000456" },
      { name: "Duplicate new lecturer", nip: "000456" },
    ],
    "faculty.json",
  );
  expect(result.added).toBe(1);
  expect(result.skipped).toBe(2);
  expect(result.data[0].source.type).toBe("manual");
});

test("a missing or empty NIP anywhere rejects the whole import", () => {
  const f = fixture();
  f.client.save({ name: "Existing", nip: "000123" });
  const before = f.saved();
  for (const input of [
    null,
    {},
    [],
    { data: "wrong" },
    [
      { name: "Valid", nip: "000456" },
      { name: "Bad number", nip: 456 },
    ],
    [{ name: "Valid", nip: "000456" }, { name: "Missing NIP" }],
    [{ name: "Blank NIP", nip: " " }],
    [{ name: " ", nip: "000456" }],
  ]) {
    expect(() => f.client.import(input, "faculty.json")).toThrow();
    expect(f.saved()).toEqual(before);
  }
});

test("large imports preserve string NIPs, provenance and the batch limit", () => {
  const f = fixture();
  const rows = Array.from({ length: 5000 }, (_, index) => ({
    name: `Lecturer ${index}`,
    nip: String(index).padStart(8, "0"),
  }));
  expect(f.client.import(rows, "large.json").added).toBe(5000);
  expect(f.restart().list().data[0].nip).toBe("00000000");
  expect(f.restart().list().data[0].source).toEqual({
    type: "file",
    filename: "large.json",
  });
  expect(f.client.import(rows).skipped).toBe(5000);
  expect(() =>
    parseLecturerImport(Array(MAX_LECTURERS + 1).fill(rows[0])),
  ).toThrow();
});
