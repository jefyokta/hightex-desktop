import { expect, test } from "bun:test";
import {
  FORM_DRAFT_KEY,
  LEGACY_FORM_DRAFT_PREFIX,
  emptyWorkspaceFormDraft,
  formDraftData,
  formDraftSelection,
  readLegacyFormDrafts,
  readWorkspaceFormDraft,
  resolveDraftConflicts,
  updateFormDraft,
} from "../src/forms/draft";
import {
  documentFormData,
  emptyFormData,
  resolveFormData,
} from "../src/forms/model";

function storage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    get length() {
      return values.size;
    },
    key: (index: number) => [...values.keys()][index] ?? null,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    values,
  };
}
const legacy = (inputs: object, choices = {}) =>
  JSON.stringify({
    version: 2,
    stage: "proposal",
    internId: "",
    inputs,
    choices,
  });

test("migration shares matching inputs and keeps conflicting values for an explicit choice", () => {
  const saved = {
    [`${LEGACY_FORM_DRAFT_PREFIX}a`]: legacy({
      proposal: { city: "Kota", eventPlace: "Ruang A", gpa: "3.8" },
      defense: { eventPlace: "Sidang" },
    }),
    [`${LEGACY_FORM_DRAFT_PREFIX}b`]: legacy({
      proposal: { city: "Kota", eventPlace: "Ruang B" },
    }),
  };
  const source = storage(saved);
  const draft = readWorkspaceFormDraft(source);
  expect(draft.values.city).toBe("Kota");
  expect(draft.values.gpa).toBe("3.8");
  expect(draft.values["defense.eventPlace"]).toBe("Sidang");
  expect(draft.values["proposal.eventPlace"]).toBeUndefined();
  expect(draft.conflicts).toEqual([
    {
      field: "proposal.eventPlace",
      options: [
        { value: "Ruang A", sources: ["a"] },
        { value: "Ruang B", sources: ["b"] },
      ],
    },
  ]);
  const resolved = resolveDraftConflicts(draft, {
    "proposal.eventPlace": "Ruang B",
  });
  expect(resolved.values["proposal.eventPlace"]).toBe("Ruang B");
  expect(resolved.conflicts).toEqual([]);
  source.setItem(FORM_DRAFT_KEY, JSON.stringify(resolved));
  expect(readWorkspaceFormDraft(source)).toEqual(resolved);
  for (const [key, raw] of Object.entries(saved))
    expect(source.getItem(key)).toBe(raw);
  expect(readLegacyFormDrafts(source)).toHaveLength(3);
});

test("shared inputs survive document changes, while schedules and selections stay separate by stage", () => {
  let draft = emptyWorkspaceFormDraft();
  const before = emptyFormData();
  draft = updateFormDraft(draft, before, {
    ...before,
    city: "Padang",
    gpa: "3.5",
    eventTime: "09:00",
  });
  draft.values["proposal.choices"] = JSON.stringify([{ code: "TA07" }]);
  expect(formDraftData(draft).eventTime).toBe("09:00");
  expect(formDraftSelection(draft)).toEqual([{ code: "TA07" }]);
  draft.stage = "defense";
  expect(formDraftData(draft).city).toBe("Padang");
  expect(formDraftData(draft).gpa).toBe("3.5");
  expect(formDraftData(draft).eventTime).toBe("");
  expect(formDraftSelection(draft).some((item) => item.code === "TA10")).toBe(
    true,
  );
  const defense = formDraftData(draft);
  draft = updateFormDraft(draft, defense, { ...defense, eventTime: "14:00" });
  expect(formDraftData(draft).eventTime).toBe("14:00");
  draft.stage = "proposal";
  expect(formDraftData(draft).eventTime).toBe("09:00");
});

test("editing another input never erases shared values hidden by document config", () => {
  const draft = emptyWorkspaceFormDraft();
  draft.values["people.head.name"] = "Shared head";
  draft.values["proposal.eventDate"] = "2026-11-20";
  const source = emptyFormData();
  source.people.head.name = "Document head";
  source.eventDate = "2026-12-01";
  const before = resolveFormData(source, formDraftData(draft));
  const updated = updateFormDraft(draft, before, {
    ...before,
    eventPlace: "Shared room",
  });
  expect(updated.values["people.head.name"]).toBe("Shared head");
  expect(updated.values["proposal.eventDate"]).toBe("2026-11-20");
  const withoutConfig = resolveFormData(
    emptyFormData(),
    formDraftData(updated),
  );
  expect(withoutConfig.people.head.name).toBe("Shared head");
  expect(withoutConfig.eventDate).toBe("2026-11-20");
});

test("migration and updates cannot store author identity, titles, core lecturers or faculty assessment", () => {
  const data = {
    ...emptyFormData(),
    name: "Old author",
    nim: "Old ID",
    title: "Old title",
    scores: { all: 100 },
    minutesComment: "STAFF",
  };
  data.people.advisor1.name = "Old advisor";
  data.people.head.name = "Head";
  const draft = readWorkspaceFormDraft(
    storage({ [`${LEGACY_FORM_DRAFT_PREFIX}a`]: legacy({ proposal: data }) }),
  );
  expect(draft.values).toEqual({
    program: "Sistem Informasi",
    city: "Pekanbaru",
    "people.head.name": "Head",
  });
  const updated = updateFormDraft(
    emptyWorkspaceFormDraft(),
    emptyFormData(),
    data,
  );
  expect(Object.keys(updated.values)).toEqual(["people.head.name"]);
  expect(formDraftData(draft).name).toBe("");
  expect(formDraftData(draft).title).toBe("");
  expect(formDraftData(draft).people.advisor1.name).toBe("");
});

test("stage selections filter unsupported codes and preserve an intentional empty selection", () => {
  const draft = readWorkspaceFormDraft(
    storage({
      [`${LEGACY_FORM_DRAFT_PREFIX}a`]: legacy(
        {},
        {
          proposal: [],
          defense: [{ code: "TA09" }, { code: "TA10" }, { code: "unknown" }],
        },
      ),
    }),
  );
  expect(formDraftSelection(draft)).toEqual([]);
  draft.stage = "defense";
  expect(formDraftSelection(draft)).toEqual([{ code: "TA10" }]);
});

test("new workspace data wins over old drafts, reset does not reimport them, and origins stay isolated", () => {
  const first = storage({
    [`${LEGACY_FORM_DRAFT_PREFIX}a`]: legacy({
      proposal: { city: "Old city" },
    }),
  });
  const reset = emptyWorkspaceFormDraft();
  first.setItem(FORM_DRAFT_KEY, JSON.stringify(reset));
  expect(readWorkspaceFormDraft(first)).toEqual(reset);
  reset.values.city = "New city";
  first.setItem(FORM_DRAFT_KEY, JSON.stringify(reset));
  expect(formDraftData(readWorkspaceFormDraft(first)).city).toBe("New city");
  expect(formDraftData(readWorkspaceFormDraft(storage())).city).toBe(
    "Pekanbaru",
  );
});

test("malformed legacy entries are ignored, but corrupt workspace data fails without mutation", () => {
  const source = storage({
    [`${LEGACY_FORM_DRAFT_PREFIX}bad`]: "broken",
    [`${LEGACY_FORM_DRAFT_PREFIX}unsupported`]:
      '{"version":7,"stage":"proposal"}',
    [FORM_DRAFT_KEY]: "broken workspace data",
  });
  expect(readLegacyFormDrafts(source)).toEqual([]);
  expect(() => readWorkspaceFormDraft(source)).toThrow();
  expect(source.getItem(FORM_DRAFT_KEY)).toBe("broken workspace data");
});

test("internship source follows the workspace profile while retaining its own title and date", () => {
  const document = {
    id: "a",
    title: "Thesis",
    config: {},
    profile: { name: "Stale author", advisorName: "Stale advisor" },
  } as HighTexDocument;
  const intern = {
    ...document,
    id: "kp",
    title: "KP title",
    config: { validityDate: "2026-11-20" },
  } as unknown as HighTexDocument;
  const profile = {
    ...emptyFormData(),
    advisorName: "Workspace advisor",
    advisorNip: "NIP",
    cv: "",
    isCloud: false,
  };
  const data = documentFormData(document, intern, "proposal", profile);
  expect(data.people.internAdvisor).toEqual({
    name: "Workspace advisor",
    nip: "NIP",
  });
  expect(data.internTitle).toBe("KP title");
  expect(data.internDate).toBe("2026-11-20");
});
