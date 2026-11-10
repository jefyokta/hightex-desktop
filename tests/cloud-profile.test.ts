import { expect, test } from "bun:test";
import { cloudProfileFromUser } from "../electron/clients/cloud-profile";
import { parseAccountUser } from "../electron/clients/auth-client";
import { resolveAuthorProfile } from "../src/utils/author-profile";

const user = () => ({
  id: 12,
  name: "Server Student",
  identity_number: "0012",
  email: "student@example.test",
  roles: [],
  advisors: [
    { name: "Secondary", identity_number: "0002", advisor_role: "secondary" },
    { name: "Primary", identity_number: "0001", advisor_role: "primary" },
  ],
  thesis_data: {
    student_id: 12,
    session_chair: { id: 3, name: "Chair", identity_number: "0003" },
    first_examiner: { id: 4, name: "Examiner", identity_number: "0004" },
    second_examiner: null,
  },
});

test("cloud workspace projects server assignments without requiring a cloud document binding", () => {
  const profile = cloudProfileFromUser(parseAccountUser(user()), {
    cv: "Cached CV",
  });
  expect(profile).toMatchObject({
    name: "Server Student",
    nim: "0012",
    cv: "Cached CV",
    advisorName: "Primary",
    advisorNip: "0001",
    secondAdvisor: { name: "Secondary", nip: "0002" },
    committee: {
      chair: { id: "3", name: "Chair", nip: "0003" },
      examiner1: { id: "4", name: "Examiner", nip: "0004" },
      examiner2: { name: "", nip: "" },
    },
  });
  // Imported documents and working branches use the same current assignments.
  const resolved = resolveAuthorProfile(
    { profile: { ...profile, advisorName: "Old", committee: {} } },
    { ...profile, isCloud: true },
  );
  expect(resolved).toEqual({ ...profile, picture: undefined });
});

test("a complete server refresh removes stale assignments and preserves offline CV", () => {
  const cached = cloudProfileFromUser(parseAccountUser(user()), {
    cv: "Offline CV",
  });
  const cleared = cloudProfileFromUser(
    parseAccountUser({ ...user(), advisors: [], thesis_data: null }),
    cached,
  );
  expect(cleared.advisorName).toBe("");
  expect(cleared.advisorNip).toBe("");
  expect(cleared.secondAdvisor).toBeUndefined();
  for (const person of Object.values(cleared.committee!))
    expect(person).toEqual({ name: "", nip: "" });
  expect(cleared.cv).toBe("Offline CV");
});

test("identity-only login responses retain cached assignments until /me refreshes them", () => {
  const cached = cloudProfileFromUser(parseAccountUser(user()));
  const identity: Partial<ReturnType<typeof user>> = user();
  delete identity.thesis_data;
  const login = cloudProfileFromUser(
    parseAccountUser({ ...identity, advisors: undefined, cv: null }),
    { ...cached, cv: "Old" },
  );
  expect(login.advisorName).toBe("Primary");
  expect(login.committee).toEqual(cached.committee);
  expect(login.cv).toBe("");
});

test("foreign or ambiguous academic data cannot replace the cached profile", () => {
  const raw = user();
  expect(() =>
    cloudProfileFromUser(
      parseAccountUser({
        ...raw,
        thesis_data: { ...raw.thesis_data, student_id: 99 },
      }),
    ),
  ).toThrow("academic_invalid");
  expect(() =>
    cloudProfileFromUser(
      parseAccountUser({
        ...raw,
        advisors: [raw.advisors[1], raw.advisors[1]],
      }),
    ),
  ).toThrow("academic_invalid");
});
