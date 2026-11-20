/** SQLite representation of directory provenance; shared by the service and fixtures. */
export function lecturerToEntity(
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
    remote_id: source.type === "cloud" ? (source.remoteId ?? null) : null,
  };
}

export function lecturerFromEntity(
  row: LecturerEntity,
): LecturerDirectoryEntry {
  return {
    id: row.id,
    name: row.name,
    nip: row.nip,
    source:
      row.source_type === "cloud"
        ? {
            type: "cloud",
            url: row.source_detail ?? "",
            ...(row.remote_id ? { remoteId: row.remote_id } : {}),
          }
        : row.source_type === "file"
          ? {
              type: "file",
              ...(row.source_detail ? { filename: row.source_detail } : {}),
            }
          : { type: row.source_type },
  };
}
