import { readFile } from "fs/promises";
import path from "path";
import { app } from "electron";

import { HasStorage } from "./concerns/has-storage";
import { LoggerService } from "./logger-service";
import { ServerService } from "./server-service";

export class CategoryService extends HasStorage<string> {
  protected storageName: string = "hightex.categories";

  static async getAll(): Promise<Category[]> {
    try {
      const cached = this.instance().getStorage().get() || "";
      const categories = this.normilize(cached);

      if (categories.length > 0) {
        return categories;
      }
    } catch {
      // Cache invalid, continue to server.
    }

    try {
      const res = await ServerService.request("/categories");
      const categories = this.normilize(res);

      if (categories.length > 0) {
        this.instance()
          .getStorage()
          .set(JSON.stringify({ data: categories }));

        return categories;
      }
    } catch (err) {
      LoggerService.write(err, "hightex:categories");
    }

    try {
      const categories = await this.getBackup();

      this.instance()
        .getStorage()
        .set(JSON.stringify({ data: categories }));

      return categories;
    } catch (err) {
      LoggerService.write(err, "hightex:categories:backup");

      return [];
    }
  }

  static async get(id: string): Promise<Category | undefined> {
    const categories = await this.getAll();

    return categories.find((c) => String(c.id) === id);
  }

  static normilize(
    raw: string | { data: (RawCategory | Category)[] },
  ): Category[] {
    const { data } = (typeof raw === "string" ? JSON.parse(raw) : raw) as {
      data: (RawCategory | Category)[];
    };

    return data.map((d) => {
      const chapters =
        typeof d.chapters === "string" ? JSON.parse(d.chapters) : d.chapters;
      if (!Array.isArray(chapters))
        throw new Error("Invalid category chapters");
      return { ...d, chapters };
    }) as Category[];
  }

  private static async getBackup(): Promise<Category[]> {
    const filePath = path.join(
      app.isPackaged
        ? process.resourcesPath
        : path.join(app.getAppPath(), "resources"),
      "category-backup.json",
    );

    const raw = await readFile(filePath, "utf8");

    return this.normilize(raw);
  }
}
