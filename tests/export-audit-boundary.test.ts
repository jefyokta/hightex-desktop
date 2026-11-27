import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

test("production capture and native installation do not import fixture geometry oracles", () => {
  for (const path of [
    "../src/document-engine/layout/chapter-compiler.ts",
    "../src/document-export/print/page-viewport.ts",
  ]) {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    expect(source).not.toContain("assertPageImagePlacement");
    expect(source).not.toContain("assertEditorPDFPresentation");
    expect(source).not.toMatch(/from ["'][^"']*tests\//);
  }
});
