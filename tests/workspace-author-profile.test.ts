import { afterEach, expect, test } from "bun:test";
import {
  emptyAuthorProfile,
  getWorkspaceAuthorProfile,
  invalidateWorkspaceAuthorProfile,
} from "../src/utils/document-profile";

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
let frame: EventTarget;
afterEach(() => {
  frame?.dispatchEvent(new Event("pagehide"));
  invalidateWorkspaceAuthorProfile();
  if (originalWindow)
    Object.defineProperty(globalThis, "window", originalWindow);
  else Reflect.deleteProperty(globalThis, "window");
});
function fixture(inFrame = true) {
  let name = "Workspace author";
  let reads = 0;
  let fail = false;
  const profiles = new Set<() => void>();
  const sessions = new Set<() => void>();
  const parent = Object.assign(new EventTarget(), {
    profile: {
      get: async () => {
        reads++;
        if (fail) throw Error("Profile unavailable");
        return { ...emptyAuthorProfile(), name, nim: "123", isCloud: false };
      },
      picture: async () => new Uint8Array([1, 2, 3]),
      onChange: (listener: () => void) => {
        profiles.add(listener);
        return () => {
          profiles.delete(listener);
        };
      },
    },
    session: {
      onChange: (listener: () => void) => {
        sessions.add(listener);
        return () => {
          sessions.delete(listener);
        };
      },
    },
  });
  frame = inFrame ? Object.assign(new EventTarget(), { parent }) : parent;
  if (!inFrame) Object.assign(parent, { parent });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: frame,
  });
  return {
    parent,
    profiles,
    sessions,
    reads: () => reads,
    rename: (value: string) => {
      name = value;
    },
    fail: (value: boolean) => {
      fail = value;
    },
  };
}

test("preview frames read the parent workspace author and picture and cache concurrent reads", async () => {
  const f = fixture();
  const [a, b] = await Promise.all([
    getWorkspaceAuthorProfile(),
    getWorkspaceAuthorProfile(),
  ]);
  expect(a).toBe(b);
  expect(a.name).toBe("Workspace author");
  expect(a.picture?.type).toBe("image/webp");
  expect(Array.from(new Uint8Array(await a.picture!.arrayBuffer()))).toEqual([
    1, 2, 3,
  ]);
  expect(f.reads()).toBe(1);
});

test("parent profile and session changes invalidate the iframe cache", async () => {
  const f = fixture();
  await getWorkspaceAuthorProfile();
  f.rename("Updated author");
  f.profiles.forEach((listener) => listener());
  expect((await getWorkspaceAuthorProfile()).name).toBe("Updated author");
  f.rename("Signed in author");
  f.sessions.forEach((listener) => listener());
  expect((await getWorkspaceAuthorProfile()).name).toBe("Signed in author");
  expect(f.reads()).toBe(3);
});

test("unloading a preview removes its listeners from the editor window", async () => {
  const f = fixture();
  await getWorkspaceAuthorProfile();
  expect(f.profiles.size).toBe(1);
  expect(f.sessions.size).toBe(1);
  frame.dispatchEvent(new Event("pagehide"));
  expect(f.profiles.size).toBe(0);
  expect(f.sessions.size).toBe(0);
});

test("a window with its own profile API uses that workspace instead of its parent's", async () => {
  const f = fixture();
  Object.assign(frame, {
    profile: {
      get: async () => ({ ...emptyAuthorProfile(), name: "Own workspace" }),
      picture: async () => false,
    },
  });
  expect((await getWorkspaceAuthorProfile()).name).toBe("Own workspace");
  expect(f.reads()).toBe(0);
});

test("top-level windows retain their own profile and retry failed reads", async () => {
  const f = fixture(false);
  f.fail(true);
  await expect(getWorkspaceAuthorProfile()).rejects.toThrow(
    "Profile unavailable",
  );
  f.fail(false);
  expect((await getWorkspaceAuthorProfile()).name).toBe("Workspace author");
  expect(f.reads()).toBe(2);
});

test("an inaccessible parent reports the missing API without substituting another identity", async () => {
  fixture();
  Object.assign(frame, {
    parent: Object.defineProperty({}, "profile", {
      get() {
        throw Error("Cross origin");
      },
    }),
  });
  await expect(getWorkspaceAuthorProfile()).rejects.toThrow(
    "Workspace profile API is not available",
  );
});
