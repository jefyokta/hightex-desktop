import { expect, test } from "bun:test";
import {
  defaultProfileChanges,
  defaultProfilePatch,
} from "../src/utils/default-profile-changes";
import { emptyAuthorProfile } from "../src/utils/document-profile";

const current: AuthorProfile = {
  ...emptyAuthorProfile(),
  name: "Document Author",
  nim: "001",
  cv: "Keep my CV",
  advisorName: "Original Advisor",
  advisorNip: "00001",
  secondAdvisor: { name: "Second Advisor", nip: "00002" },
  committee: {
    chair: { id: "1", name: "Original Chair", nip: "00003" },
    examiner1: { name: "Keep Examiner", nip: "00004" },
  },
};
const defaults: Omit<Profile, "cv"> = {
  ...emptyAuthorProfile(),
  name: "Default Author",
  nim: "002",
  advisorName: "Updated Advisor",
  advisorNip: "00011",
  committee: { chair: { id: "7", name: "Updated Chair", nip: "00013" } },
};

test("preview compares identities and complete lecturer selections without mutating them", () => {
  const snapshot = structuredClone({ current, defaults });
  const changes = defaultProfileChanges(current, defaults);
  expect(changes.find((change) => change.field === "advisor")?.before).toEqual({
    text: "Original Advisor",
    nip: "00001",
  });
  expect(changes.find((change) => change.field === "advisor")?.after).toEqual({
    text: "Updated Advisor",
    nip: "00011",
  });
  expect(
    changes
      .filter((change) => change.clearsValue)
      .map((change) => change.field),
  ).toEqual(["secondAdvisor", "examiner1"]);
  expect({ current, defaults }).toEqual(snapshot);
});

test("selective copy keeps other lecturers, CV and literal NIPs", () => {
  const patch = defaultProfilePatch(
    current,
    defaults,
    new Set(["advisor", "chair"]),
  );
  const result = { ...current, ...patch };
  expect(result.name).toBe(current.name);
  expect(result.nim).toBe(current.nim);
  expect(result.advisorNip).toBe("00011");
  expect(result.secondAdvisor).toEqual(current.secondAdvisor);
  expect(result.committee?.chair).toEqual(defaults.committee?.chair);
  expect(result.committee?.examiner1).toEqual(current.committee?.examiner1);
  expect(result.cv).toBe("Keep my CV");
  patch.committee!.chair!.name = "Changed copy";
  expect(defaults.committee?.chair?.name).toBe("Updated Chair");
});

test("empty defaults clear data only when the corresponding field is explicitly selected", () => {
  const blank = emptyAuthorProfile();
  const changes = defaultProfileChanges(current, blank);
  expect(changes.every((change) => change.clearsValue)).toBe(true);
  expect(defaultProfilePatch(current, blank, new Set())).toEqual({});
  const patch = defaultProfilePatch(
    current,
    blank,
    new Set(["chair", "secondAdvisor"]),
  );
  expect(patch).toHaveProperty("secondAdvisor", undefined);
  expect(patch.committee?.chair).toBeUndefined();
  expect(patch.committee?.examiner1).toEqual(current.committee?.examiner1);
  expect(patch).not.toHaveProperty("advisorName");
});

test("a partially empty lecturer default also requires explicit review", () => {
  const changes = defaultProfileChanges(current, {
    ...defaults,
    advisorNip: "",
  });
  expect(
    changes.find((change) => change.field === "advisor")?.clearsValue,
  ).toBe(true);
});

test("internship defaults copy only author identity and keep manual advisors", () => {
  expect(
    defaultProfileChanges(current, defaults, true).map(
      (change) => change.field,
    ),
  ).toEqual(["name", "nim"]);
  const patch = defaultProfilePatch(
    current,
    defaults,
    new Set(["name", "nim", "advisor", "chair"]),
    true,
  );
  expect(patch).toEqual({ name: defaults.name, nim: defaults.nim });
  expect({ ...current, ...patch }.advisorName).toBe("Original Advisor");
});

test("identical visible data and directory-ID-only changes do not create a copy operation", () => {
  expect(
    defaultProfileChanges(current, {
      ...current,
      committee: {
        ...current.committee,
        chair: { ...current.committee!.chair!, id: "other-id" },
      },
    }),
  ).toEqual([]);
  expect(
    defaultProfilePatch(current, current, new Set(["name", "chair"])),
  ).toEqual({});
});
