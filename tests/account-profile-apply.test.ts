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

test("cloud workspace applies the bound account identity globally while preserving server academic assignments", () => {
  const photo = new Blob(["account photo"]);
  const resolved = resolveAuthorProfile(source, {
    isCloud: true,
    name: "Account author",
    nim: "ACCOUNT",
    cv: "Account CV",
    picture: photo,
  });
  expect(resolved).toMatchObject({
    name: "Account author",
    nim: "ACCOUNT",
    cv: "Account CV",
    advisorName: "Assigned advisor",
    advisorNip: "001",
    committee: source.profile!.committee,
  });
  expect(resolved.picture).toBe(photo);
  expect(source.profile?.name).toBe("Old author");
});

test("clearing the Cloud account CV and photo does not fall back to imported document data", () => {
  const resolved = resolveAuthorProfile(source, {
    isCloud: true,
    name: "Account author",
    nim: "ACCOUNT",
    cv: "",
  });
  expect(resolved.cv).toBe("");
  expect(resolved.picture).toBeUndefined();
  expect(resolved.advisorName).toBe("Assigned advisor");
});
