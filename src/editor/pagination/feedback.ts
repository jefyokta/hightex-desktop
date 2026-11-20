import { paginationGeometry, type PaginationOptions } from "./options";
import { pxToMm } from "@/utils/units";

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
      top: Number(pxToMm(page.margins.top).toFixed(6)),
      right: Number(pxToMm(page.margins.right).toFixed(6)),
      bottom: Number(pxToMm(page.margins.bottom).toFixed(6)),
      left: Number(pxToMm(page.margins.left).toFixed(6)),
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
    "## Experimental editor page view",
    "",
    "### Reproduction",
    "",
    details.trim().slice(0, PAGINATION_FEEDBACK_LIMIT),
    "",
    "### Diagnostics",
    "",
    `- HighTex: ${diagnostics.appVersion}`,
    `- Platform: ${diagnostics.platform}`,
    `- Layout: ${diagnostics.status}`,
    `- Chapter pages: ${diagnostics.chapterPages ?? "n/a"}`,
    `- Margins (mm, top/right/bottom/left): ${diagnostics.marginsMm.top}/${diagnostics.marginsMm.right}/${diagnostics.marginsMm.bottom}/${diagnostics.marginsMm.left}`,
    `- Repeat table header: ${diagnostics.repeatTableHeader}`,
    `- Repeat table caption: ${diagnostics.repeatTableCaption}`,
  ].join("\n");
}
