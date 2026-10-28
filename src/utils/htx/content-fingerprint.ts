import { parseHighTexV2, type ImportedHighTexV2 } from "@hightex/importer";

async function hashBytes(input: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(input));

  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

const compare = (left: string, right: string) =>
  left < right ? -1 : left > right ? 1 : 0;
const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => compare(left, right))
        .map(([key, item]) => [key, canonical(item)]),
    );
  return value;
};
export async function contentFingerprint(
  input: Uint8Array | ImportedHighTexV2,
): Promise<string> {
  const model = input instanceof Uint8Array ? parseHighTexV2(input) : input;
  const encoder = new TextEncoder();
  const entries: Record<string, unknown> = {
    // Manifest IDs may differ between local and cloud copies of the same content.
    "files/config.json": model.config,
    "files/assets/references.json": model.references,
    "files/assets/variables.json": [...model.variables].sort((left, right) =>
      compare(left.name, right.name),
    ),
    "files/assets/aliases.json": [...model.aliases].sort((left, right) =>
      compare(left.key, right.key),
    ),
  };

  for (const chapter of model.chapters) {
    entries[`files/chapters/${chapter.id}.json`] = chapter.content;
  }

  if (Object.keys(model.images).length) {
    const images: Record<string, string> = {};
    for (const [id, image] of Object.entries(model.images)) {
      images[id] = await hashBytes(image.bytes);
    }
    entries["files/assets/images.json"] = images;
  }

  const jsonEntries = Object.entries(entries).sort(([a], [b]) => compare(a, b));
  const parts = jsonEntries.flatMap(([name, data]) => [
    encoder.encode(name),
    new Uint8Array([0]),
    encoder.encode(JSON.stringify(canonical(data))),
    new Uint8Array([0]),
  ]);
  const totalLength = parts.reduce((total, part) => total + part.length, 0);
  const inputBytes = new Uint8Array(totalLength);
  let offset = 0;

  for (const part of parts) {
    inputBytes.set(part, offset);
    offset += part.length;
  }

  return hashBytes(inputBytes);
}
