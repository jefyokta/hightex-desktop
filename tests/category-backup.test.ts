import { expect, mock, test } from "bun:test";
import path from "node:path";

let cached = "";
let requests = 0;
let serverResponse: string | { data: Category[] } | undefined;
const runtime = { isPackaged: false, getAppPath: () => process.cwd() };
mock.module("electron", () => ({ app: runtime }));
mock.module("../electron/service/concerns/has-storage", () => ({
  HasStorage: class {
    static instance() {
      return new this();
    }
    getStorage() {
      return {
        get: () => cached,
        set: (value: string) => {
          cached = value;
        },
      };
    }
  },
}));
mock.module("../electron/service/server-service", () => ({
  ServerService: {
    request: async () => {
      requests++;
      if (serverResponse !== undefined) return serverResponse;
      throw new Error("Offline");
    },
  },
}));
mock.module("../electron/service/logger-service", () => ({
  LoggerService: { write: () => {} },
}));

const { CategoryService } =
  await import("../electron/service/category-service");

test("offline categories load from bundled backup in development and packaged app, then use cache", async () => {
  const previousResources = process.resourcesPath;
  try {
    for (const packaged of [false, true]) {
      runtime.isPackaged = packaged;
      Object.defineProperty(process, "resourcesPath", {
        configurable: true,
        value: path.join(process.cwd(), "resources"),
      });
      cached = "invalid cache";
      const before = requests;
      const categories = await CategoryService.getAll();
      expect(categories.length).toBeGreaterThan(0);
      expect(requests).toBe(before + 1);
      expect(await CategoryService.getAll()).toEqual(categories);
      expect(requests).toBe(before + 1);
    }
    const backup = cached;
    cached = "";
    serverResponse = backup;
    expect((await CategoryService.getAll()).length).toBeGreaterThan(0);
    expect(JSON.parse(cached)).toEqual(JSON.parse(serverResponse));
    cached = "";
    serverResponse = JSON.parse(backup);
    expect((await CategoryService.getAll()).length).toBeGreaterThan(0);
    expect(JSON.parse(cached)).toEqual(serverResponse);
    for (const invalid of [
      '{"data":[]}',
      '{"data":[{"chapters":null}]}',
      "broken",
    ]) {
      cached = "";
      serverResponse = invalid;
      expect((await CategoryService.getAll()).length).toBeGreaterThan(0);
    }
    cached = "";
    serverResponse = undefined;
    Object.defineProperty(process, "resourcesPath", {
      configurable: true,
      value: path.join(process.cwd(), "missing-resources"),
    });
    expect(await CategoryService.getAll()).toEqual([]);
  } finally {
    Object.defineProperty(process, "resourcesPath", {
      configurable: true,
      value: previousResources,
    });
  }
});
