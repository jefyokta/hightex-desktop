import { PluginKey, type Transaction } from "@tiptap/pm/state";
import { DecorationSet } from "@tiptap/pm/view";
import type { PageLayout } from "./flow/page-planner";
import type { PaginationOptions } from "./options";
import { paginationDecorations } from "./presentation/decorations";
import { sectionResultDecorations } from "./section-result";
import type { CompiledChapter } from "@/document-engine/layout/chapter-compiler";
import type { SectionLayoutResult } from "../../../shared/section-layout";
import type { PaginationDiagnostic } from "@/types/pagination/diagnostic";

export interface PaginationState {
  options: PaginationOptions;
  enabled: boolean;
  pending: boolean;
  decorations: DecorationSet;
  layout: PageLayout;
  /** Retained with visible layout while its ready result is invalidated. */
  layoutComposition?: SectionLayoutResult["composition"];
  result?: Readonly<SectionLayoutResult>;
  error?: string;
  diagnostic?: PaginationDiagnostic;
  numbering?: DocumentNumberingState;
}
export interface DocumentNumberingState {
  diagnostic?: PaginationDiagnostic;
  labels?: string[];
  pending: boolean;
  error?: string;
}
export type PaginationUpdate = {
  diagnostic?: PaginationDiagnostic;
  enabled?: boolean;
  layout?: PageLayout;
  options?: PaginationOptions;
  pending?: boolean;
  numbering?: DocumentNumberingState;
  compiled?: Pick<CompiledChapter, "source" | "result" | "plan">;
  error?: string;
};
export const paginationKey = new PluginKey<PaginationState>("editorPagination");
export const emptyLayout = (): PageLayout => ({
  breaks: [],
  pages: 1,
});

export function createPaginationState(options: PaginationOptions): PaginationState {
  return {
    options,
    enabled: false,
    pending: false,
    decorations: DecorationSet.empty,
    layout: emptyLayout(),
  };
}

/** Derived state transitions stay here; the extension only wires commands and views. */
export function applyPaginationTransaction(
  tr: Transaction,
  previous: PaginationState,
): PaginationState {
  const update = tr.getMeta(paginationKey) as PaginationUpdate | undefined;
  const enabled = update?.enabled ?? previous.enabled;
  const options = update?.options ?? previous.options;
  const reset = update?.enabled !== undefined || update?.options !== undefined;
  let numbering = update?.numbering ?? previous.numbering;
  if (!enabled) numbering = undefined;
  else if (!update?.numbering && (reset || tr.docChanged))
    numbering = { labels: previous.numbering?.labels, pending: true };

  if (!enabled || reset)
    return {
      ...createPaginationState(options),
      enabled,
      pending: enabled && !update?.layout && !update?.compiled,
      numbering,
    };

  const compiled = update?.compiled;
  const layout = compiled?.plan ?? update?.layout ?? previous.layout;
  const invalidated = tr.docChanged || update?.pending === true;
  let decorations = previous.decorations.map(tr.mapping, tr.doc);
  if (compiled)
    decorations = sectionResultDecorations(tr.doc, compiled.source, compiled.result);
  else if (update?.layout)
    decorations = paginationDecorations(tr.doc, layout);

  // Pending work keeps its visible composition, but no longer exposes a ready result.
  let layoutComposition = previous.layoutComposition;
  if (update?.layout) layoutComposition = undefined;
  else if (compiled) layoutComposition = compiled.result.composition;

  let result = compiled?.result ?? previous.result;
  if (invalidated || update?.layout) result = undefined;

  return {
    options,
    enabled,
    numbering,
    layout,
    decorations,
    pending: !update?.layout && !compiled && (invalidated || previous.pending),
    layoutComposition,
    error: compiled ? undefined : update?.error ?? previous.error,
    diagnostic: compiled || invalidated ? undefined : update?.diagnostic ?? previous.diagnostic,
    result,
  };
}
