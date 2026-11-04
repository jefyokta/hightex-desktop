import { createHash } from "node:crypto";
import { unzipSync } from "fflate";

const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonical(item)]),
    );
  return value;
};

/** Compare all archive content, including manifest and profile, without ZIP timestamps. */
export function archiveFingerprint(bytes: Uint8Array): string {
  const hash = createHash("sha256");
  const entries = unzipSync(bytes);
  if (!entries["manifest.json"]) throw new Error("Missing HighTex manifest");
  for (const name of Object.keys(entries).sort()) {
    if (name.endsWith("/")) continue;
    const value = entries[name];
    const content = name.endsWith(".json")
      ? Buffer.from(
          JSON.stringify(
            canonical(JSON.parse(Buffer.from(value).toString("utf8"))),
          ),
        )
      : value;
    hash.update(JSON.stringify([name, content.length]));
    hash.update(content);
  }
  return hash.digest("hex");
}
