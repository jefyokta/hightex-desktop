import { readFileSync } from "node:fs";
import { normalizeWorkspaceServer } from "./identity";

export function workspaceAccountEmail(value: unknown): string | undefined {
  return typeof value === "string" &&
    value.length <= 320 &&
    /^[^\s@]+@[^\s@]+$/.test(value.trim())
    ? value.trim()
    : undefined;
}

/** Recover only this workspace's verified account label, never a token or another account. */
export function cachedWorkspaceEmail(
  filename: string,
  profile: WorkspaceProfile,
): string | undefined {
  if (!profile.accountId || !profile.serverUrl) return;
  try {
    const config = JSON.parse(readFileSync(filename, "utf8")) as Record<
      string,
      unknown
    >;
    const session = config.session as
      | { user?: { id?: unknown; email?: unknown }; serverUrl?: unknown }
      | undefined;
    if (
      String(session?.user?.id) !== profile.accountId ||
      typeof session?.serverUrl !== "string" ||
      normalizeWorkspaceServer(session.serverUrl) !== profile.serverUrl
    )
      return;
    return workspaceAccountEmail(session.user?.email);
  } catch {
    return undefined;
  }
}
