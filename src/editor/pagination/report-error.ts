import { ShouldNotified } from "@/exception/interfaces/should-notified";
import { ShouldSilent } from "@/exception/should-silent";
import { ShouldReport } from "@/exception/should-report";
import { DocumentEngineError } from "@/exception/document-engine-error";

/** UI adapters classify failures once; the layout core retains its domain errors. */
export function paginationReport(
  error: unknown,
  context: string,
): ShouldReport | undefined {
  if (error instanceof ShouldReport) return error;
  let reason = error;
  while (reason instanceof DocumentEngineError && reason.level !== "warning")
    reason = reason.cause;
  if (
    reason instanceof ShouldNotified ||
    reason instanceof ShouldSilent ||
    (reason instanceof Error && reason.name === "AbortError") ||
    (reason instanceof DocumentEngineError && reason.level === "warning")
  )
    return;
  const detail =
    error instanceof Error ? error.stack || error.message : String(error);
  const diagnostic =
    error instanceof DocumentEngineError
      ? `\n${JSON.stringify({ ...error.diagnostic, code: error.code, target: error.target, level: error.level })}`
      : "";
  return new ShouldReport(`${context}\n${detail}${diagnostic}`, error);
}
