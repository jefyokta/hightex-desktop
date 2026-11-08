import { expect, test } from "bun:test";
import { previewDocumentDraft } from "../src/editor/document-drafts";
const current: HighTexDocument = {
  id: "doc",
  category: "1",
  title: "Saved title",
  altTitle: "",
  keywords: { indonesian: [], english: [] },
  config: {},
  profile: {
    name: "Writer",
    nim: "123",
    advisorName: "Advisor",
    advisorNip: "00001",
    cv: "Current CV",
    picture: new Blob(["current picture"]),
  },
};
test("previewing a settings draft includes metadata without accepting per-document profile overrides", () => {
  const draft: HighTexDocument = {
    ...current,
    title: "Draft title",
    profile: {
      ...current.profile!,
      cv: "Stale CV",
      picture: new Blob(["stale"]),
      committee: { chair: { name: "Chair", nip: "00002" } },
    },
  };
  const preview = previewDocumentDraft(current, draft);
  expect(preview.title).toBe("Draft title");
  expect(preview.profile).toBe(current.profile);
  expect(preview.profile?.cv).toBe("Current CV");
  expect(preview.profile?.picture).toBe(current.profile?.picture);
  expect(current.title).toBe("Saved title");
  expect(current.profile?.committee).toBeUndefined();
});
test("a draft for another document cannot enter the archive preview", () => {
  expect(
    previewDocumentDraft(current, {
      ...current,
      id: "other",
      title: "Wrong document",
    }),
  ).toBe(current);
  expect(previewDocumentDraft(current)).toBe(current);
});
