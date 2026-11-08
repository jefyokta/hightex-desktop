import { expect, test } from "bun:test";
import {
  GENERAL_FORM_FIELDS,
  INTERNSHIP_FORM_FIELDS,
  SCHEDULE_FORM_FIELDS,
  formFieldProblem,
  formPackageProblems,
  changeFormField,
} from "../src/forms/fields";
import { documentFormData, emptyFormData } from "../src/forms/model";

test("package review finds problems in every selected form, including B1 while another PDF is previewed", () => {
  const data = {
    ...emptyFormData(),
    name: "Writer",
    nim: "001",
    title: "Title",
    gpa: "5.0",
    credits: "12.5",
  };
  const problems = formPackageProblems(data, "proposal", ["TA07", "B1"]);
  expect(
    problems
      .filter((item) => item.problem !== "missing")
      .map((item) => item.field.key),
  ).toEqual(["gpa", "credits"]);
  expect(
    problems.some(
      (item) => item.field.key === "internTitle" && item.problem === "missing",
    ),
  ).toBe(true);
  expect(
    formPackageProblems(data, "proposal", ["TA07"]).some(
      (item) => item.problem === "gpa",
    ),
  ).toBe(false);
  expect(
    formPackageProblems(data, "defense", ["TA07", "B1"]).some(
      (item) => item.problem === "gpa",
    ),
  ).toBe(false);
});

test("numeric, calendar, and time checks catch invalid stored input without treating optional blanks as invalid", () => {
  const gpa = INTERNSHIP_FORM_FIELDS.find((field) => field.key === "gpa")!;
  const credits = INTERNSHIP_FORM_FIELDS.find(
    (field) => field.key === "credits",
  )!;
  const date = SCHEDULE_FORM_FIELDS.find((field) => field.key === "eventDate")!;
  const time = SCHEDULE_FORM_FIELDS.find((field) => field.key === "eventTime")!;
  const data = emptyFormData();
  expect(formFieldProblem(gpa, data)).toBe("missing");
  for (const value of ["-1", "4.1", "abc", "1e3"])
    expect(formFieldProblem(gpa, { ...data, gpa: value })).toBe("gpa");
  for (const value of ["0", "4", "3,85"])
    expect(formFieldProblem(gpa, { ...data, gpa: value })).toBeUndefined();
  for (const value of ["-1", "1.5", "abc"])
    expect(formFieldProblem(credits, { ...data, credits: value })).toBe(
      "credits",
    );
  expect(
    formFieldProblem(credits, { ...data, credits: "144" }),
  ).toBeUndefined();
  expect(formFieldProblem(date, { ...data, eventDate: "2026-02-30" })).toBe(
    "date",
  );
  expect(
    formFieldProblem(date, { ...data, eventDate: "2028-02-29" }),
  ).toBeUndefined();
  expect(formFieldProblem(time, { ...data, eventTime: "25:99" })).toBe("time");
  expect(
    formFieldProblem(time, { ...data, eventTime: "09:30" }),
  ).toBeUndefined();
});

test("shared inputs and profile identity can be prepared before choosing a document", () => {
  const source = documentFormData(undefined, undefined, "proposal", {
    name: "Workspace writer",
    nim: "001",
    advisorName: "Advisor",
    advisorNip: "002",
    cv: "",
    isCloud: false,
  });
  expect(source.name).toBe("Workspace writer");
  expect(source.title).toBe("");
  expect(source.people.advisor1.name).toBe("Advisor");
  const edited = changeFormField(source, "people.head.name", "Head");
  expect(edited.people.head.name).toBe("Head");
  expect(source.people.head.name).toBe("");
  const problems = formPackageProblems(edited, "proposal", ["TA07"]);
  expect(
    problems
      .filter((item) => item.field.required)
      .map((item) => item.field.key),
  ).toEqual(["title"]);
  expect(GENERAL_FORM_FIELDS.some((field) => field.key === "program")).toBe(
    true,
  );
});
