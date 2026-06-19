import { ServerService } from "./server-service";
import { LoggerService } from "./logger-service";
import { HasStorage } from "./concerns/has-storage";
export class CategoryService extends HasStorage<string> {
  protected storageName: string = "hightex.categories";

  static async getAll(): Promise<Category[]> {
    try {
      const cached = this.instance().getStorage().get() || "";
      try {
        return this.normilize(cached);
      } catch (e) {}
      const res = await ServerService.request("/categories");

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
