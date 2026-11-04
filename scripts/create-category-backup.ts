import { mkdir } from "node:fs/promises";
import path from "node:path";
import { parseCategoryDirectory } from "../src/utils/category-directory";
import { ServerUrl } from "../electron/url/server-url";

(async () => {
  const response = await fetch(ServerUrl.instance.endpoint("/categories"), {
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }
  const categories = parseCategoryDirectory(await response.json());
  if (!categories.length) throw new Error("The category directory is empty");

  const folder = path.resolve(process.cwd(), "resources");
  const output = path.join(folder, "category-backup.json");

  await mkdir(folder, { recursive: true });

  await Bun.write(output, JSON.stringify({ data: categories }, null, 2));
})();
