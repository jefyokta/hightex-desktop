import { expect, test } from "bun:test";
import {
  emptyAuthorProfile,
  resolveAuthorProfile,
} from "../src/utils/author-profile";

const document = (profile?: AuthorProfile): HighTexDocument => ({
  id: "document",
  title: "Title",
  altTitle: "",
  category: "1",
  keywords: { indonesian: [], english: [] },
  config: {},
  profile,
  authorProfileMode: "document",
});

test("local workspace identity replaces legacy per-document identity without mutating its archive", () => {
  const archived = {
    ...emptyAuthorProfile(),
    name: "Archived writer",
    nim: "OLD",
    cv: "Old CV",
    picture: new Blob(["old"]),
    committee: { chair: { name: "Old chair", nip: "1" } },
  };
  const source = document(archived);
  const workspace = {
    ...emptyAuthorProfile(),
    name: "Workspace writer",
    nim: "NEW",
    committee: {},
  };
  expect(resolveAuthorProfile(source, workspace)).toEqual({
    ...workspace,
    picture: undefined,
  });
  expect(source.profile).toBe(archived);
  expect(source.profile?.name).toBe("Archived writer");
});

test("explicitly empty workspace values do not restore stale document CV, photo or committee", () => {
  const source = document({
    ...emptyAuthorProfile(),
    name: "Old writer",
    cv: "Old CV",
    picture: new Blob(["old"]),
    committee: { chair: { name: "Old chair", nip: "1" } },
  });
  expect(resolveAuthorProfile(source, emptyAuthorProfile())).toMatchObject({
    name: "",
    cv: "",
    committee: {},
    picture: undefined,
  });
});

test("snapshot resolution without a workspace preserves the archived writer", () => {
  const profile = {
    ...emptyAuthorProfile(),
    name: "Snapshot writer",
    cv: "Snapshot CV",
  };
  expect(resolveAuthorProfile(document(profile))).toEqual({
    ...profile,
    committee: {},
  });
});
