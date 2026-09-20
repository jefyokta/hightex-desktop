import { mkdir, rename } from "node:fs/promises";
import path from "node:path";

const response = await fetch(
  "https://raw.githubusercontent.com/jefyokta/hightex-project/main/info.json",
  { cache: "no-store" },
);
if (!response.ok) throw new Error(`Server info: HTTP ${response.status}`);
const info = await response.json();
const host = info.apiUrl || info.serverUrl || info.serverHost;
if (typeof host !== "string" || !host) throw new Error("Missing server URL");

const categories = await fetch(`${host.replace(/\/$/, "")}/categories`, {
  headers: { "content-type": "application/json" },
});
if (!categories.ok) throw new Error(`Categories: HTTP ${categories.status}`);
const json = await categories.json();
if (!Array.isArray(json.data) || json.data.length === 0) {
  throw new Error("Category response must contain a non-empty data array");
}
for (const category of json.data) {
  const chapters =
    typeof category.chapters === "string"
      ? JSON.parse(category.chapters)
      : category.chapters;
  if (!Array.isArray(chapters)) throw new Error("Invalid category chapters");
}

const folder = path.resolve(import.meta.dir, "../resources");
await mkdir(folder, { recursive: true });
const output = path.join(folder, "category-backup.json");
await Bun.write(`${output}.tmp`, JSON.stringify(json, null, 2) + "\n");
await rename(`${output}.tmp`, output);
