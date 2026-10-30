import { expect, test } from "bun:test";
import {
  confirm,
  registerConfirm,
  type ConfirmDialogOptions,
  type ConfirmResult,
} from "../src/utils/confirm";
import { resolveImportMode } from "../src/utils/import-conflict";
import type { HighTexImporter } from "../src/utils/import-v2";

const importer = (exists: boolean) =>
  ({
    exists,
    model: { document: { title: "Imported document" } },
  }) as Pick<HighTexImporter, "exists" | "model">;

test("a new document imports without prompting", async () => {
  let prompts = 0;
  registerConfirm(async () => {
    prompts++;
    return false;
  });
  expect(await resolveImportMode(importer(false))).toBe("overwrite");
  expect(prompts).toBe(0);
});

test("duplicate import offers overwrite, copy and cancellation", async () => {
  let options: ConfirmDialogOptions | undefined;
  let result: ConfirmResult = "alternative";
  registerConfirm(async (received) => {
    options = received;
    return result;
  });
  expect(await resolveImportMode(importer(true))).toBe("copy");
  expect(options?.alternativeText).toBeTruthy();
  expect(options?.confirmText).toBeTruthy();
  expect(options?.cancelText).toBeTruthy();
  expect(options?.desc).toContain("Imported document");
  result = true;
  expect(await resolveImportMode(importer(true))).toBe("overwrite");
  result = false;
  expect(await resolveImportMode(importer(true))).toBeNull();
});

test("existing confirmation callers continue receiving booleans", async () => {
  registerConfirm(async () => true);
  expect(await confirm("Delete?")).toBe(true);
  registerConfirm(async () => false);
  expect(await confirm({ title: "Cancel?" })).toBe(false);
});
