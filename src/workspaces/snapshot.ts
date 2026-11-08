import type Dexie from "dexie";

async function encode(value: unknown): Promise<unknown> {
  if (value instanceof Blob)
    return {
      __hightexWorkspaceBlob: true,
      type: value.type,
      bytes: new Uint8Array(await value.arrayBuffer()),
    };
  if (value instanceof Date || value instanceof Uint8Array) return value;
  if (Array.isArray(value)) return Promise.all(value.map(encode));
  if (value && typeof value === "object")
    return Object.fromEntries(
      await Promise.all(
        Object.entries(value).map(async ([key, item]) => [
          key,
          await encode(item),
        ]),
      ),
    );
  return value;
}

function decode(value: unknown): unknown {
  if (value instanceof Date || value instanceof Uint8Array) return value;
  if (Array.isArray(value)) return value.map(decode);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (
      record.__hightexWorkspaceBlob === true &&
      record.bytes instanceof Uint8Array
    )
      return new Blob([new Uint8Array(record.bytes)], {
        type: String(record.type),
      });
    return Object.fromEntries(
      Object.entries(record).map(([key, item]) => [key, decode(item)]),
    );
  }
  return value;
}

export async function captureWorkspaceData(
  db: Dexie,
): Promise<WorkspaceDataSnapshot> {
  const tables = await db.transaction("r", db.tables, async () =>
    Object.fromEntries(
      await Promise.all(
        db.tables.map(async (table) => [table.name, await table.toArray()]),
      ),
    ),
  );
  return {
    tables: (await encode(tables)) as WorkspaceDataSnapshot["tables"],
    localStorage: Object.fromEntries(
      Object.keys(localStorage)
        .filter((key) => !key.startsWith("workspace:migration:"))
        .map((key) => [key, localStorage.getItem(key)!]),
    ),
  };
}

export async function restoreWorkspaceData(
  db: Dexie,
  snapshot: WorkspaceDataSnapshot,
) {
  const tables = decode(snapshot.tables) as WorkspaceDataSnapshot["tables"];
  for (const name of Object.keys(tables))
    if (!db.tables.some((table) => table.name === name))
      throw Error(`Unknown table: ${name}`);
  await db.transaction("rw", db.tables, async () => {
    for (const table of db.tables) {
      await table.clear();
      if (tables[table.name]?.length) await table.bulkPut(tables[table.name]);
    }
  });
  // Only staging origins reach this route; an interrupted attempt can be retried.
  localStorage.clear();
  Object.entries(snapshot.localStorage).forEach(([key, value]) =>
    localStorage.setItem(key, value),
  );
}

export function canonicalWorkspaceSnapshot(value: unknown): string {
  const canonical = (item: unknown): unknown => {
    if (item instanceof Date) return { date: item.toISOString() };
    if (item instanceof Uint8Array) return { bytes: Array.from(item) };
    if (Array.isArray(item)) return item.map(canonical);
    if (item && typeof item === "object")
      return Object.fromEntries(
        Object.entries(item)
          .filter(([, value]) => value !== undefined)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, value]) => [key, canonical(value)]),
      );
    return item;
  };
  return JSON.stringify(canonical(value));
}

export async function workspaceSnapshotHash(snapshot: WorkspaceDataSnapshot) {
  const bytes = new TextEncoder().encode(canonicalWorkspaceSnapshot(snapshot));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
