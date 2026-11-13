import { paginationGeometry, type PaginationOptions } from "./options";

export const PAGINATION_FEEDBACK_LIMIT = 4000;

interface FeedbackState {
  enabled: boolean;
  pending: boolean;
  options: PaginationOptions;
  layout: { pages: number; error?: boolean };
}

export interface PaginationDiagnostics {
  appVersion: string;
  platform: string;
  status: "unavailable" | "disabled" | "pending" | "failed" | "ready";
  chapterPages: number | null;
  marginsMm: { top: number; right: number; bottom: number; left: number };
  repeatTableHeader: boolean;
  repeatTableCaption: boolean;
}

/** Allowlist only presentation settings; never serialize plugin/editor state. */
export function paginationDiagnostics(
  state: FeedbackState | undefined,
  appVersion: string,
  platform: string,
): PaginationDiagnostics {
  const page = paginationGeometry(state?.options);
  const mm = (value: number) => Number(((value * 25.4) / 96).toFixed(6));
  return {
    appVersion,
    platform,
    status: !state
      ? "unavailable"
      : !state.enabled
        ? "disabled"
        : state.layout.error
          ? "failed"
          : state.pending
            ? "pending"
            : "ready",
    chapterPages: state?.enabled ? state.layout.pages : null,
    marginsMm: {
      top: mm(page.margins.top),
      right: mm(page.margins.right),
      bottom: mm(page.margins.bottom),
      left: mm(page.margins.left),
    },
    repeatTableHeader: page.repeatTableHeader,
    repeatTableCaption: page.repeatTableCaption,
  };
}

export function paginationFeedbackText(
  diagnostics: PaginationDiagnostics,
  details: string,
): string {
  // Explicit fields also protect callers that pass an object with extra keys.
  return [
    "Experimental editor page view",
    "",
    details.trim().slice(0, PAGINATION_FEEDBACK_LIMIT),
    "",
    `HighTex: ${diagnostics.appVersion}`,
    `Platform: ${diagnostics.platform}`,
    `Layout: ${diagnostics.status}`,
    `Chapter pages: ${diagnostics.chapterPages ?? "n/a"}`,
    `Margins (mm, top/right/bottom/left): ${diagnostics.marginsMm.top}/${diagnostics.marginsMm.right}/${diagnostics.marginsMm.bottom}/${diagnostics.marginsMm.left}`,
    `Repeat table header: ${diagnostics.repeatTableHeader}`,
    `Repeat table caption: ${diagnostics.repeatTableCaption}`,
  ].join("\n");
}
