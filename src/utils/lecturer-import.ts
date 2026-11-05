export const MAX_LECTURERS = 50000;
export const MAX_LECTURER_IMPORT_BYTES = 16 * 1024 * 1024;

export function parseLecturerPerson(
  value: unknown,
  allowEmptyNip = false,
): {
  name: string;
  nip: string;
} {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Invalid lecturer");
  const row = value as Record<string, unknown>;
  if (
    typeof row.name !== "string" ||
    !row.name.trim() ||
    row.name.length > 500 ||
    typeof row.nip !== "string" ||
    (!allowEmptyNip && !row.nip.trim()) ||
    row.nip.length > 200
  )
    throw Error("Invalid lecturer");
  // NIPs remain strings: coercing a JSON number could lose leading zeroes.
  return {
    name: row.name.trim(),
    nip: row.nip.trim(),
  };
}

/** Accept an array or a directory object's data array; never trust imported IDs. */
export function parseLecturerImport(
  value: unknown,
): { name: string; nip: string }[] {
  const data = Array.isArray(value)
    ? value
    : value && typeof value === "object"
      ? (value as Record<string, unknown>).data
      : undefined;
  if (!Array.isArray(data) || !data.length || data.length > MAX_LECTURERS)
    throw Error("Invalid lecturer import");
  return data.map((row) => parseLecturerPerson(row));
}
