import Store from "electron-store";
import { ServerService } from "./server-service";
import { LoggerService } from "./logger-service";
export class CategoryService {
  private static store = new Store();

  static async getAll(): Promise<Category[]> {
    try {
      const cached = this.store.get<any, string>("hightex.categories");
      try {
        return this.normilize(cached);
      } catch (e) {}
      const res = await ServerService.request("/categories");

      this.store.set("hightex.categories", res);
      return this.normilize(res);
    } catch (err) {
      LoggerService.write(err, "hightex:categories");
      return [];
    }
  }

  static async get(id: string) {
    const categories = await this.getAll();

    return categories.find((c) => String(c.id) == id);
  }

  static normilize(rawStr: string): Category[] {
    const { data } = JSON.parse(rawStr) as { data: RawCategory[] };
    return data.map((d) => ({
      ...d,
      chapters: JSON.parse(d.chapters) as Category["chapters"],
    })) as Category[];
  }
}
