import { app } from "electron";
import { parseCategoryDirectory } from "../../src/utils/category-directory";
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
      // Invalid cache triggers installer recovery.
    }

    // A broken/empty cache should work offline without waiting on a request.
    const cachedCategories = this.validCachedCategories(cached);
    const recovered = await this.withBackup(cachedCategories);
    if (recovered.length > cachedCategories.length) return recovered;
    try {
      return await this.refresh();
    } catch (error) {
      LoggerService.write(error, "hightex:categories");
      return recovered;
    }
  }

  static async get(id: string): Promise<Category | undefined> {
    const categories = await this.getAll();
    const find = (categories: Category[]) =>
      categories.find((category) => String(category.id) === String(id));
    const category = find(categories);
    if (category) return category;
    // Recover only when this specific ID is missing, not on every cache read.
    const recovered = find(await this.withBackup(categories));
    if (recovered) return recovered;
    try {
      return find(await this.refresh());
    } catch (error) {
      LoggerService.write(error, "hightex:category");
      return undefined;
    }
  }

  /** Fetch explicitly; a failed request never replaces the offline cache. */
  static async refresh(): Promise<Category[]> {
    const raw = await ServerService.request("/categories", {
      signal: AbortSignal.timeout(15000),
    });
    const categories = this.normilize(raw);
    if (!categories.length) throw new Error("The category directory is empty");
    // Retain retired IDs so existing offline documents can still be opened.
    const cached = this.validCachedCategories(
      this.instance().getStorage().get(),
    );
    const ids = new Set(categories.map((category) => category.id));
    const merged = [
      ...categories,
      ...cached.filter((category) => !ids.has(category.id)),
    ];
    this.instance()
      .getStorage()
      .set(JSON.stringify({ data: merged }));
    return merged;
  }

  static normilize(raw: unknown): Category[] {
    return parseCategoryDirectory(raw);
  }

  private static validCachedCategories(raw: unknown): Category[] {
    try {
      const value = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (!value || !Array.isArray(value.data)) return [];
      const categories = new Map<number, Category>();
      const duplicates = new Set<number>();
      for (const entry of value.data) {
        try {
          const [category] = this.normilize({ data: [entry] });
          if (categories.has(category.id)) {
            categories.delete(category.id);
            duplicates.add(category.id);
          } else if (!duplicates.has(category.id))
            categories.set(category.id, category);
        } catch {
          /* Recover other records and repair this one from the backup. */
        }
      }
      return [...categories.values()];
    } catch {
      return [];
    }
  }

  private static async withBackup(categories: Category[]): Promise<Category[]> {
    try {
      const backup = await this.getBackup();
      const ids = new Set(categories.map((category) => category.id));
      const recovered = backup.filter((category) => !ids.has(category.id));
      if (recovered.length) {
        const merged = [...categories, ...recovered];
        this.instance()
          .getStorage()
          .set(JSON.stringify({ data: merged }));
        return merged;
      }
    } catch (error) {
      LoggerService.write(error, "hightex:categories:backup");
    }
    return categories;
  }

  private static async getBackup(): Promise<Category[]> {
    const filePath = app.isPackaged
      ? path.join(process.resourcesPath, "category-backup.json")
      : path.join(app.getAppPath(), "resources", "category-backup.json");

    const raw = await readFile(filePath, "utf8");

    return this.normilize(raw);
  }
}
