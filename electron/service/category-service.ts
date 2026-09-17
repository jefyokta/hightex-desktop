import { readFile } from "fs/promises";
import path from "path";

import { HasStorage } from "./concerns/has-storage";
import { LoggerService } from "./logger-service";
import { ServerService } from "./server-service";

export class CategoryService extends HasStorage<string> {
  protected storageName: string = "hightex.categories";

  static async getAll(): Promise<Category[]> {
    const cached = this.instance().getStorage().get() || "";

    try {
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
        this.instance().getStorage().set(res);

        return categories;
      }
    } catch (err) {
      LoggerService.write(err, "hightex:categories");
      //error, try backup
    }

    try {
      const categories = await this.getBackup();

      this.instance()
        .getStorage()
        .set(JSON.stringify({ data: categories}));

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

  static normilize(rawStr: string): Category[] {
    const { data } = JSON.parse(rawStr) as {
      data: (RawCategory | Category)[];
    };

    return data.map((d) => ({
      ...d,
      chapters: typeof d.chapters == 'string' ? JSON.parse(d.chapters) as Category["chapters"] :d.chapters,
    })) as Category[];
  }

  private static async getBackup(): Promise<Category[]> {
    const filePath = path.join(
      process.resourcesPath,
      "category-backup.json",
    );

    const raw = await readFile(filePath, "utf8");

    return this.normilize(raw);
  }
}