import { expect, test } from "bun:test";
import {
  emptyAuthorProfile,
  resolveAuthorProfile,
} from "../src/utils/author-profile";

const source: HighTexDocument = {
  id: "cloud-document",
  title: "Cloud document",
  altTitle: "",
  category: "1",
  keywords: { indonesian: [], english: [] },
  config: {},
  profile: {
    ...emptyAuthorProfile(),
    name: "Old author",
    nim: "OLD",
    cv: "Old CV",
    picture: new Blob(["old photo"]),
    advisorName: "Assigned advisor",
    advisorNip: "001",
    committee: { chair: { name: "Server chair", nip: "002" } },
  },
};

test("cloud workspace applies the bound account identity and current academic assignments globally", () => {
  const photo = new Blob(["account photo"]);
  const resolved = resolveAuthorProfile(source, {
    isCloud: true,
    name: "Account author",
    nim: "ACCOUNT",
    cv: "Account CV",
    picture: photo,
    advisorName: "Current server advisor",
    advisorNip: "003",
    secondAdvisor: { name: "Second advisor", nip: "004" },
    committee: { examiner1: { id: "5", name: "Current examiner", nip: "005" } },
  });
  expect(resolved).toMatchObject({
    name: "Account author",
    nim: "ACCOUNT",
    cv: "Account CV",
    advisorName: "Current server advisor",
    advisorNip: "003",
    secondAdvisor: { name: "Second advisor", nip: "004" },
    committee: { examiner1: { id: "5", name: "Current examiner", nip: "005" } },
  });
  expect(resolved.picture).toBe(photo);
  expect(source.profile?.name).toBe("Old author");
});

test("cleared Cloud assignments, CV and photo never fall back to imported document data", () => {
  const resolved = resolveAuthorProfile(source, {
    ...emptyAuthorProfile(),
    isCloud: true,
    name: "Account author",
    nim: "ACCOUNT",
    cv: "",
    committee: {},
  });
  expect(resolved.cv).toBe("");
  expect(resolved.picture).toBeUndefined();
  expect(resolved.advisorName).toBe("");
  expect(resolved.advisorNip).toBe("");
  expect(resolved.secondAdvisor).toBeUndefined();
  expect(resolved.committee).toEqual({});
});
