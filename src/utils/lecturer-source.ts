/** Provenance is separate from database location and never requests a download. */
export function parseLecturerSource(value: unknown): LecturerSource {
  if (value === undefined) return { type: "unknown" };
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Invalid lecturer source");
  const row = value as Record<string, unknown>;
  switch (row.type) {
    case "manual":
      return { type: "manual" };
    case "unknown":
      return { type: "unknown" };
    case "file": {
      if (row.filename === undefined) return { type: "file" };
      if (
        typeof row.filename !== "string" ||
        !row.filename.trim() ||
        row.filename.length > 500
      )
        throw Error("Invalid source filename");
      const filename = row.filename.trim().split(/[\\/]/).pop();
      if (!filename) throw Error("Invalid source filename");
      return { type: "file", filename };
    }
    case "cloud": {
      if (typeof row.url !== "string" || row.url.length > 2000)
        throw Error("Invalid source URL");
      const url = new URL(row.url);
      if (
        !["https:", "http:"].includes(url.protocol) ||
        url.username ||
        url.password
      )
        throw Error("Invalid source URL");
      return { type: "cloud", url: url.href };
    }
    default:
      throw Error("Invalid lecturer source");
  }
}
