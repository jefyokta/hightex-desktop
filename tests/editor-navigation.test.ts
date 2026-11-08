import { expect, test } from "bun:test";
import { isEditorDocumentPath } from "../src/workspaces/editor-navigation";

test("an editor window can navigate through its own chapters and versions", () => {
  for (const pathname of [
    "/document/doc-a",
    "/document/doc-a/",
    "/document/doc-a/1",
    "/document/doc-a/cv",
    "/document/doc-a/1/version-a",
  ])
    expect(isEditorDocumentPath(pathname, "doc-a")).toBe(true);
});

test("an editor window rejects application pages, printing, and other documents", () => {
  for (const pathname of [
    "/profile",
    "/workspaces",
    "/dashboard",
    "/document/doc-b/1",
    "/document/doc-a/print",
    "/document/doc-a/print/true",
    "/document/doc-a/1/version/extra",
    "/document/doc-a/%70rint",
  ])
    expect(isEditorDocumentPath(pathname, "doc-a")).toBe(false);
});
