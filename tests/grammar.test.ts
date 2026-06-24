import { Grammar } from "@main/database/builder/grammar";
import { test, expect } from "bun:test";

const grammar = new Grammar();
test("multiple", () => {
  const r = grammar.pluralize("Mahasiswa");
  expect(r).toBe("mahasiswas");
});
test("end witih 's'", () => {
  const r = grammar.pluralize("Kampus");
  expect(r).toBe("kampuses");
});
