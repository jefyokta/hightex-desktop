import { describe, expect, test } from "bun:test";
import { migrateDocumentCommittee } from "../src/utils/document-committee";
import {
  buildFormFiles,
  defaultSelection,
  documentFormData,
  emptyFormData,
  resolveFormData,
  validatePrintInput,
  type FormPrintInput,
} from "../src/forms/model";
import {
  ADVISOR_RUBRIC,
  EXAM_RUBRIC,
  CHAIR_RUBRIC,
} from "../src/forms/assessment-rubrics";
const profile: AuthorProfile = {
  name: "Student A",
  nim: "123",
  advisorName: "Advisor A",
  advisorNip: "NIP-A",
  secondAdvisor: { name: "Advisor B", nip: "NIP-B" },
  committee: {
    chair: { name: "Chair", nip: "" },
    examiner1: { name: "Examiner 1", nip: "" },
    examiner2: { name: "Examiner 2", nip: "" },
  },
  cv: "",
};
const document: HighTexDocument = {
  id: "doc-a",
  category: "1",
  title: "Sistem _machine learning_",
  altTitle: "",
  keywords: { indonesian: [], english: [] },
  profile,
  config: {
    kaprodi: { name: "Head", nip: "NIP-H" },
    consentDate: new Date(2026, 10, 2),
    validityDate: new Date(2026, 10, 3),
  },
};
const fixture = (
  stage: FormPrintInput["stage"] = "proposal",
): FormPrintInput => ({
  documentId: document.id,
  stage,
  data: documentFormData(document, undefined, stage),
  selection: defaultSelection(stage),
});
describe("local form generation", () => {
  test("runtime ignores legacy committee config until it is migrated to profile", () => {
    const legacy = {
      ...document,
      profile: { ...profile, committee: undefined },
      config: {
        ...document.config,
        leader: "Stale Chair",
        member_1: "Stale Examiner",
      },
    };
    expect(documentFormData(legacy).people.chair.name).toBe("");
    expect(documentFormData(legacy).people.examiner1.name).toBe("");
    expect(
      documentFormData(migrateDocumentCommittee(legacy)).people.chair.name,
    ).toBe("Stale Chair");
  });
  test("committee names and NIPs come from profile and explicitly cleared roles ignore legacy config", () => {
    const selected = {
      ...document,
      profile: {
        ...profile,
        committee: {
          chair: { id: "chair", name: "Profile Chair", nip: "0001" },
          examiner1: { name: "Profile Examiner", nip: "0002" },
        },
      },
    };
    const data = documentFormData(selected);
    expect(data.people.chair).toEqual({ name: "Profile Chair", nip: "0001" });
    expect(data.people.examiner1).toEqual({
      name: "Profile Examiner",
      nip: "0002",
    });
    expect(data.people.examiner2).toEqual({ name: "", nip: "" });
    expect(
      documentFormData({
        ...selected,
        profile: { ...selected.profile, committee: {} },
      }).people.chair.name,
    ).toBe("");
  });
  test("uses authoritative document profile/config and local fallback only for legacy documents", () => {
    const fallback = {
      ...profile,
      name: "Default author",
      advisorName: "Default advisor",
    };
    expect(
      documentFormData(document, undefined, "proposal", fallback).name,
    ).toBe(profile.name);
    const legacy = { ...document, profile: undefined };
    const data = documentFormData(legacy, undefined, "proposal", fallback);
    expect(data.name).toBe(fallback.name);
    expect(data.people.advisor1.name).toBe(fallback.advisorName);
    expect(data.people.chair.name).toBe("Chair");
    const own = { ...document, profile: { ...profile, name: "" } };
    expect(documentFormData(own, undefined, "proposal", fallback).name).toBe(
      "",
    );
  });
  test("fills dates from the selected stage's config", () => {
    expect(fixture().data.eventDate).toBe("2026-11-02");
    expect(fixture("defense").data.eventDate).toBe("2026-11-03");
    expect(fixture().data.signDate).toBe("2026-11-02");
  });
  test("manual supplements cannot overwrite profile/config or bring back staff fields", () => {
    const source = documentFormData(document);
    const draft = {
      ...emptyFormData(),
      name: "Wrong",
      title: "Wrong",
      scores: { "TA02:advisor1": ["100"] },
      revisions: {
        advisor1: { comment: "INJECTED COMMENT", changes: "INJECTED REVISION" },
      },
    };
    draft.people.advisor1 = { name: "Wrong", nip: "Wrong" };
    draft.people.examiner1.nip = "NIP-E";
    const resolved = resolveFormData(source, draft);
    expect(resolved.name).toBe(profile.name);
    expect(resolved.title).toBe(document.title);
    expect(resolved.people.advisor1.name).toBe("Advisor A");
    expect(resolved.people.examiner1.nip).toBe("");
    draft.people.chair = { name: "Stale chair", nip: "Stale NIP" };
    const cleared = documentFormData({
      ...document,
      profile: { ...profile, committee: {} },
    });
    expect(resolveFormData(cleared, draft).people.chair).toEqual({
      name: "",
      nip: "",
    });
    expect("scores" in resolved).toBe(false);
    expect("revisions" in resolved).toBe(false);
  });
  test("second advisor automatically controls form copies", () => {
    const input = fixture();
    let files = buildFormFiles(input);
    expect(files.filter((f) => f.code === "TA02")).toHaveLength(2);
    expect(files.filter((f) => f.code === "TA03")).toHaveLength(4);
    expect(files.filter((f) => f.code === "TA07")).toHaveLength(1);
    input.data.secondAdvisor = undefined;
    files = buildFormFiles(input);
    expect(files.filter((f) => f.code === "TA02")).toHaveLength(1);
    expect(files.filter((f) => f.code === "TA03")).toHaveLength(3);
    expect(files.filter((f) => f.code === "B3")).toHaveLength(3);
  });
  test("stage constraints and individual archive filenames remain deterministic", () => {
    for (const stage of ["proposal", "defense"] as const) {
      const files = buildFormFiles(fixture(stage));
      expect(new Set(files.map((f) => f.filename)).size).toBe(files.length);
      expect(files.some((f) => f.code === "B0")).toBe(stage === "proposal");
      expect(files.some((f) => f.code === "B1")).toBe(stage === "proposal");
      expect(files.some((f) => f.code === "TA09")).toBe(stage === "proposal");
      expect(files.some((f) => f.code === "TA10")).toBe(stage === "defense");
      expect(files.filter((f) => f.code === "B3").length).toBe(4);
    }
  });
  test("authored assessment tables retain the official weights", () => {
    for (const rubric of [ADVISOR_RUBRIC, EXAM_RUBRIC, CHAIR_RUBRIC]) {
      expect(
        rubric
          .flatMap((section) => section.criteria)
          .reduce((sum, criterion) => sum + criterion.weight, 0),
      ).toBe(100);
    }
  });
  test("defense excludes proposal-only forms even in a previously saved selection", () => {
    const input = fixture("defense");
    input.selection = [
      { code: "B0" },
      { code: "B1" },
      { code: "B3" },
      { code: "TA10" },
    ];
    const codes = buildFormFiles(input).map((file) => file.code);
    expect(codes).not.toContain("B0");
    expect(codes).not.toContain("B1");
    expect(codes).toContain("B3");
    expect(codes).toContain("TA10");
  });
  test("all committee members belong to one attendance form", () => {
    expect(
      buildFormFiles(fixture()).find((file) => file.code === "TA01")?.pages,
    ).toBe(1);
    const input = fixture();
    input.data.secondAdvisor = undefined;
    expect(
      buildFormFiles(input).find((file) => file.code === "TA01")?.pages,
    ).toBe(1);
  });
  test("B1 uses the KP document's university advisor", () => {
    const kp = {
      ...document,
      title: "KP title",
      profile: { ...profile, advisorName: "KP advisor" },
    };
    const data = documentFormData(document, kp);
    expect(data.internTitle).toBe("KP title");
    expect(data.people.internAdvisor.name).toBe("KP advisor");
  });
  test("validates print requests", () => {
    expect(validatePrintInput(fixture())).toBe(true);
    expect(validatePrintInput(null as unknown as FormPrintInput)).toBe(false);
    const input = fixture();
    input.data.name = "x".repeat(2_000_001);
    expect(validatePrintInput(input)).toBe(false);
  });
});
