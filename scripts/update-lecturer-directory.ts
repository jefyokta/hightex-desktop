import { rename, unlink } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parseLecturerDirectory } from "../electron/service/lecturer-directory-client";

const input = process.argv.indexOf("--source");
const configured =
  input >= 0 ? process.argv[input + 1] : "https://hightex.jefyokta.dev/api/";
if (!configured) throw Error("Provide --source <server URL>");
const base = new URL(configured);
if (
  !["https:", "http:"].includes(base.protocol) ||
  base.username ||
  base.password ||
  base.search ||
  base.hash
)
  throw Error("Invalid source URL");
const source = new URL("/api/", base.origin).href;
const response = await fetch(new URL("lecturers", source), {
  headers: { Accept: "application/json" },
  redirect: "error",
  credentials: "omit",
  signal: AbortSignal.timeout(15000),
});
if (!response.ok)
  throw Error(`Directory request failed: HTTP ${response.status}`);
const text = await response.text();
if (new TextEncoder().encode(text).byteLength > 4 * 1024 * 1024)
  throw Error("Directory too large");
const payload = parseLecturerDirectory(JSON.parse(text));
const target = fileURLToPath(
  new URL("../src/assets/data/lecturer-directory.json", import.meta.url),
);
const temporary = `${target}.tmp`;
try {
  await Bun.write(
    temporary,
    JSON.stringify(
      { source, generated_at: new Date().toISOString(), ...payload },
      null,
      2,
    ) + "\n",
  );
  await rename(temporary, target);
} finally {
  await unlink(temporary).catch(() => {});
}
console.log(
  `Saved ${payload.data.length} public lecturer records to ${target}`,
);
