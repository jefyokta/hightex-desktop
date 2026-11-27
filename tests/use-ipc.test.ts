import { afterEach, expect, test } from "bun:test";
import { useIPC } from "../src/hooks/use-ipc";

const original = Object.getOwnPropertyDescriptor(globalThis, "window");
afterEach(() => {
  if (original) Object.defineProperty(globalThis, "window", original);
  else Reflect.deleteProperty(globalThis, "window");
});
function frame(value: object) {
  Object.defineProperty(globalThis, "window", { configurable: true, value });
  return value as Window;
}

test("IPC resolves top-level namespaces without requiring React or an initialized parent", async () => {
  const items: ZoteroItem[] = [{ key: "item", title: "Item" }];
  const host = frame({ zotero: { listItems: async () => items } });
  expect(useIPC("zotero")).toBe(host);
  expect(await useIPC("zotero").zotero.listItems("localhost", 23119)).toEqual(items);
});

test("IPC selects a same-origin parent for a frame without that preload namespace", () => {
  const parent = { config: {}, zotero: {} };
  frame({ parent });
  expect(useIPC("config") as object).toBe(parent);
  expect(useIPC("zotero") as object).toBe(parent);
});

test("frame-local snapshot adapters take precedence without changing the host", () => {
  const parent = { hightex: { marker: "workspace" }, ipcRenderer: { marker: "host" }, profile: {} };
  const local = frame({ parent, hightex: { marker: "snapshot" }, ipcRenderer: { marker: "frame" } });
  expect(useIPC("hightex")).toBe(local);
  expect(useIPC("ipcRenderer")).toBe(local);
  expect(useIPC("profile") as object).toBe(parent);
  expect(parent.hightex.marker).toBe("workspace");
});

test("an inaccessible parent cannot substitute an unrelated bridge", () => {
  const parent = Object.defineProperty({}, "document", { get() { throw new DOMException("Blocked", "SecurityError"); } });
  const local = frame({ parent });
  expect(useIPC("profile")).toBe(local);
  expect(useIPC("profile").profile).toBeUndefined();
});

test("IPC rechecks a late local bridge instead of retaining its parent's namespace", () => {
  const parent = { hightex: {} };
  const local = frame({ parent });
  expect(useIPC("hightex") as object).toBe(parent);
  Object.assign(local, { hightex: {} });
  expect(useIPC("hightex")).toBe(local);
  expect(useIPC("editor")).toBe(local);
});
