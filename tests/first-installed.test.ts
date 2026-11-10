import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function fixture(initial?: string) {
  const files = new Map<string, string>();
  const file = "/profile/installed.json";
  if (initial !== undefined) files.set(file, initial);
  let fail = false;
  return {
    files,
    file,
    fail: (value: boolean) => {
      fail = value;
    },
    launch: (version = "1.2.0", profilePath = "/profile") => {
      const modules = {
        electron: {
          app: { getPath: () => profilePath, getVersion: () => version },
        },
        path: { join: (...parts: string[]) => parts.join("/") },
        fs: {
          default: {
            existsSync: (name: string) => files.has(name),
            readFileSync: (name: string) => files.get(name),
            writeFileSync: (name: string, data: string) => {
              if (fail) throw Error("Disk full");
              files.set(name, data);
            },
            renameSync: (from: string, to: string) => {
              files.set(to, files.get(from)!);
              files.delete(from);
            },
          },
        },
      };
      const sandbox = {
        exports: {} as typeof import("../electron/utilities/first-installed"),
        require: (name: string) => modules[name as keyof typeof modules],
      };
      vm.runInNewContext(
        ts.transpileModule(
          readFileSync(
            new URL(
              "../electron/utilities/first-installed.ts",
              import.meta.url,
            ),
            "utf8",
          ),
          {
            compilerOptions: {
              module: ts.ModuleKind.CommonJS,
              target: ts.ScriptTarget.ES2020,
            },
          },
        ).outputText,
        sandbox,
      );
      return sandbox.exports;
    },
  };
}

test("first installation is stable across repeated renderer loads in one launch and records the running version", () => {
  const f = fixture();
  const app = f.launch();
  const first = app.firstInstalled();
  expect(first.firstInstalled).toBe(true);
  expect(first.installedVersion).toBe("1.2.0");
  expect(first.currentVersion).toBe("1.2.0");
  expect(first.previousVersion).toBeNull();
  expect(app.firstInstalled()).toEqual(first);
  const next = f.launch().firstInstalled();
  expect(next.firstInstalled).toBe(false);
  expect(next.versionChanged).toBe(false);
  expect(next.time).toBe(first.time);
});

test("installation date, original version and dismissed guides survive upgrades and downgrades", () => {
  const f = fixture();
  const first = f.launch("1.1.2");
  const time = first.firstInstalled().time;
  first.acknowledgeGuides([
    { id: "welcome", revision: 1 },
    { id: "workspace-1-1-2", revision: 1 },
  ]);
  const upgrade = f.launch("1.2.0").firstInstalled();
  expect(upgrade.previousVersion).toBe("1.1.2");
  expect(upgrade.versionChanged).toBe(true);
  expect(upgrade.installedVersion).toBe("1.1.2");
  expect(upgrade.time).toBe(time);
  expect(upgrade.seenGuides.welcome).toBe(1);
  f.launch("1.1.2").acknowledgeGuides([{ id: "welcome", revision: 1 }]);
  expect(f.launch("1.2.0").firstInstalled().seenGuides["workspace-1-1-2"]).toBe(
    1,
  );
});

test("legacy plain timestamps migrate without pretending an existing install is new", () => {
  const f = fixture("2025-03-12T04:05:06.000Z");
  const status = f.launch().firstInstalled();
  expect(status.firstInstalled).toBe(false);
  expect(status.time).toBe("2025-03-12T04:05:06.000Z");
  expect(status.installedVersion).toBeNull();
  expect(status.profileSetupPending).toBe(false);
  expect(JSON.parse(f.files.get(f.file)!).lastVersion).toBe("1.2.0");
});

test("welcome remains pending until acknowledged and stays independent per workspace", () => {
  const f = fixture();
  const first = f.launch("1.4.2", "/workspaces/first");
  expect(first.firstInstalled().profileSetupPending).toBe(true);
  expect(
    f.launch("1.4.2", "/workspaces/first").firstInstalled().profileSetupPending,
  ).toBe(true);
  expect(first.acknowledgeProfileSetup().profileSetupPending).toBe(false);
  expect(
    f.launch("1.4.3", "/workspaces/first").firstInstalled().profileSetupPending,
  ).toBe(false);
  expect(
    f.launch("1.4.3", "/workspaces/second").firstInstalled().profileSetupPending,
  ).toBe(true);
});

test("a failed welcome acknowledgment remains pending and can be retried", () => {
  const f = fixture();
  const app = f.launch();
  app.firstInstalled();
  f.fail(true);
  expect(() => app.acknowledgeProfileSetup()).toThrow("Disk full");
  expect(app.firstInstalled().profileSetupPending).toBe(true);
  f.fail(false);
  expect(app.acknowledgeProfileSetup().profileSetupPending).toBe(false);
  expect(f.launch().firstInstalled().profileSetupPending).toBe(false);
});

test("a damaged marker recovers without losing access to the application or declaring a fresh install", () => {
  const status = fixture("broken data").launch().firstInstalled();
  expect(status.firstInstalled).toBe(false);
  expect(Number.isFinite(Date.parse(status.time))).toBe(true);
  expect(status.seenGuides).toEqual({});
});

test("guide acknowledgments cannot downgrade a revision or partially apply invalid input", () => {
  const app = fixture().launch();
  app.acknowledgeGuides([{ id: "welcome", revision: 3 }]);
  expect(
    app.acknowledgeGuides([{ id: "welcome", revision: 1 }]).seenGuides.welcome,
  ).toBe(3);
  expect(() =>
    app.acknowledgeGuides([
      { id: "new-guide", revision: 1 },
      { id: "../invalid", revision: 1 },
    ]),
  ).toThrow();
  expect(app.firstInstalled().seenGuides["new-guide"]).toBeUndefined();
  expect(() => app.acknowledgeGuides([{ id: "bad", revision: 0 }])).toThrow();
});

test("a failed persistence write does not acknowledge a guide and can be retried", () => {
  const f = fixture();
  const app = f.launch();
  app.firstInstalled();
  f.fail(true);
  expect(() => app.acknowledgeGuides([{ id: "welcome", revision: 1 }])).toThrow(
    "Disk full",
  );
  expect(app.firstInstalled().seenGuides.welcome).toBeUndefined();
  f.fail(false);
  expect(
    app.acknowledgeGuides([{ id: "welcome", revision: 1 }]).seenGuides.welcome,
  ).toBe(1);
});
