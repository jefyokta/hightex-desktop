export const CLOUD_ERROR_CODES = [
  "not_authenticated",
  "session_changed",
  "invalid_request",
  "invalid_response",
  "invalid_download",
  "integrity_failed",
  "cloud_changed",
  "replacement_required",
  "editor_open",
  "local_changed",
  "kp_unsupported",
  "unknown_category",
  "external_asset",
  "invalid_archive",
  "unsupported_content",
  "busy",
  "academic_changed",
  "academic_invalid",
  "academic_scope",
  "http_401",
  "http_403",
  "http_422",
  "request_failed",
] as const;

export type KnownCloudErrorCode = (typeof CLOUD_ERROR_CODES)[number];
export type CloudErrorCode = KnownCloudErrorCode | `http_${number}`;

export function getCloudErrorCode(error: unknown): CloudErrorCode | undefined {
  const known = (value: unknown): value is CloudErrorCode =>
    typeof value === "string" &&
    (CLOUD_ERROR_CODES.includes(value as KnownCloudErrorCode) ||
      /^http_\d+$/.test(value));
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    known(error.code)
  )
    return error.code;
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  if (known(message)) return message;
  const code =
    /(?:cloud_error|CloudError):\s*(?:CloudError:\s*)?([a-zA-Z0-9_]+)/.exec(
      message,
    )?.[1];
  return known(code) ? code : undefined;
}
