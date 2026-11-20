import type { DocumentRenderModel } from "@/types/document-snapshot";
import { getProfileVariables } from "@/utils/document-profile";
import { Symbols } from "@/utils/symbol";

/** Resolve variable precedence once for rendering and layout dependency tracking. */
export function chapterVariables(model: DocumentRenderModel) {
  const variables = new Map<string, string>([
    ...Symbols.map(([name, value]) => [name, value] as [string, string]),
    ...model.variables.map((row) => [row.name, row.value] as [string, string]),
    ...Object.entries(getProfileVariables(model.profile)),
  ]);
  variables.set("title", model.document.title);
  variables.set("altTitle", model.document.altTitle);
  return variables;
}
