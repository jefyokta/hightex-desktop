import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { cloudProfileFromUser } from "../electron/clients/cloud-profile";
import { parseAccountUser } from "../electron/clients/auth-client";
import { resolveAuthorProfile } from "../src/utils/author-profile";

function fixture(type: "local" | "cloud" = "cloud") {
  const records = new Map<string, unknown>();
  let cached: Profile | undefined;
  const local: Profile = {
    name: "Local writer",
    nim: "LOCAL",
    advisorName: "Local advisor",
    advisorNip: "local",
    cv: "Local CV",
    committee: {},
  };
  const runtime = { profile: { type, accountId: "12" } };
  const profileService = {
    get: () => local,
    getCloudProfile: () => cached,
    setCloudProfile: (profile: Profile) => {
      cached = structuredClone(profile);
    },
  };
  const dependencies: Record<string, unknown> = {
    "electron-store": {
      default: class {
        get(key: string) {
          return records.get(key);
        }
        set(key: string, value: unknown) {
          records.set(key, structuredClone(value));
        }
        delete(key: string) {
          records.delete(key);
        }
      },
    },
    electron: {},
    "node:fs": {},
    "node:path": {},
    "../url/server-url": {},
    "../workspaces/runtime": { WorkspaceRuntime: runtime },
    "./profile-service": { ProfileService: profileService },
    "../clients/cloud-profile": { cloudProfileFromUser },
  };
  function load<T>(file: string): T {
    const sandbox = {
      exports: {} as T,
      require: (name: string) => dependencies[name],
      setTimeout,
      clearTimeout,
    };
    vm.runInNewContext(
      ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2020,
        },
      }).outputText,
      sandbox,
    );
    return sandbox.exports;
  }
  const { SessionService } = load<
    typeof import("../electron/service/session-service")
  >("../electron/service/session-service.ts");
  dependencies["./session-service"] = { SessionService };
  const { DocumentProfileService } = load<
    typeof import("../electron/service/document-profile-service")
  >("../electron/service/document-profile-service.ts");
  return {
    SessionService,
    DocumentProfileService,
    local,
    cached: () => cached,
    records,
  };
}
const assigned = () =>
  parseAccountUser({
    id: 12,
    name: "Cloud writer",
    identity_number: "CLOUD",
    email: "cloud@example.test",
    roles: [],
    cv: "Cloud CV",
    advisors: [
      {
        name: "Cloud advisor",
        identity_number: "0001",
        advisor_role: "primary",
      },
    ],
    thesis_data: {
      student_id: 12,
      session_chair: { id: 5, name: "Cloud chair", identity_number: "0005" },
    },
  });

test("session refresh updates the workspace author for unbound documents and keeps assignments after sign-out", () => {
  const f = fixture();
  f.SessionService.setUser(assigned());
  const online = f.DocumentProfileService.get();
  expect(online).toMatchObject({
    isCloud: true,
    name: "Cloud writer",
    advisorName: "Cloud advisor",
    committee: { chair: { id: "5", name: "Cloud chair", nip: "0005" } },
  });
  const imported = {
    profile: { ...f.local, advisorName: "Old imported advisor" },
  };
  expect(resolveAuthorProfile(imported, online).advisorName).toBe(
    "Cloud advisor",
  );
  f.SessionService.clearUser();
  expect(f.DocumentProfileService.get()).toEqual(online);
  expect(imported.profile.advisorName).toBe("Old imported advisor");
});

test("removed server assignments overwrite the offline cache and cannot resurrect local fields", () => {
  const f = fixture();
  f.SessionService.setUser(assigned());
  f.SessionService.setUser(
    parseAccountUser({ ...assigned(), advisors: [], thesis_data: null }),
  );
  f.SessionService.clearUser();
  const offline = f.DocumentProfileService.get();
  expect(offline.advisorName).toBe("");
  expect(offline.secondAdvisor).toBeUndefined();
  expect(offline.committee?.chair).toEqual({ name: "", nip: "" });
  expect(offline.cv).toBe("Cloud CV");
});

test("a different account and a local workspace cannot replace this workspace's cached author", () => {
  const f = fixture();
  f.SessionService.setUser(assigned());
  const own = f.DocumentProfileService.get();
  f.SessionService.setUser(
    parseAccountUser({
      ...assigned(),
      id: 99,
      name: "Other account",
      thesis_data: null,
    }),
  );
  expect(f.DocumentProfileService.get()).toEqual(own);
  const local = fixture("local");
  local.SessionService.setUser(assigned());
  expect(local.cached()).toBeUndefined();
  expect(local.DocumentProfileService.get()).toEqual({
    ...local.local,
    isCloud: false,
  });
});

test("upgrading an identity-only cache reads assignments from the persisted server session", () => {
  const f = fixture();
  f.records.set("session.user", assigned());
  expect(f.DocumentProfileService.get().advisorName).toBe("Cloud advisor");
});
