import { mkdir } from "node:fs/promises";
import path from "node:path";
import { ServerUrl } from "../electron/url/server-url";

(async () => {
  const response = await fetch(ServerUrl.instance.endpoint("/categories"), {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }
  const json: unknown = await response.json();

  const folder = path.resolve(process.cwd(), "resources");
  const output = path.join(folder, "category-backup.json");

  await mkdir(folder, { recursive: true });

  await Bun.write(output, JSON.stringify(json, null, 2));
})();
