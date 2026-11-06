import {
  MAX_LECTURERS,
  parseLecturerPerson,
} from "../../src/utils/lecturer-import";
import { parseLecturerSource } from "../../src/utils/lecturer-source";
import type { LocalLecturerDirectory } from "../directory/lecturer-directory";

export interface LecturerCloudSession {
  sessionId: string;
  serverUrl: string;
  accountId: string;
  token: string;
}
interface Transport {
  session(): LecturerCloudSession | null;
  request(
    session: LecturerCloudSession,
  ): Promise<{ status: number; data?: unknown }>;
  unauthenticated(session: LecturerCloudSession): void;
}

export function parseCloudLecturers(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Invalid response");
  const raw = value as Record<string, unknown>;
  if (
    raw.schema_version !== 1 ||
    typeof raw.version !== "string" ||
    !/^[a-f0-9]{64}$/.test(raw.version) ||
    !Array.isArray(raw.data) ||
    raw.data.length > MAX_LECTURERS
  )
    throw Error("Invalid response");
  const ids = new Set<string>();
  return raw.data.map((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw Error("Invalid lecturer");
    const row = value as Record<string, unknown>;
    if (
      typeof row.id !== "string" ||
      !row.id.trim() ||
      row.id.length > 200 ||
      ids.has(row.id)
    )
      throw Error("Invalid lecturer ID");
    ids.add(row.id);
    return parseLecturerPerson(row);
  });
}

/** Fetch only on explicit intent. Late responses cannot cross a login/server change. */
export class LecturerCloudClient {
  private pending = new Map<string, Promise<LecturerCloudResult>>();
  constructor(
    private directory: LocalLecturerDirectory,
    private transport: Transport,
  ) {}

  private session() {
    try {
      return this.transport.session();
    } catch {
      return null;
    }
  }

  private current(expected: LecturerCloudSession) {
    const actual = this.session();
    return (
      actual &&
      actual.sessionId === expected.sessionId &&
      actual.serverUrl === expected.serverUrl &&
      actual.accountId === expected.accountId &&
      actual.token === expected.token
    );
  }

  fetch(): Promise<LecturerCloudResult> {
    const session = this.session();
    if (!session?.token)
      return Promise.resolve({ ok: false, error: "not_authenticated" });
    const existing = this.pending.get(session.sessionId);
    if (existing) return existing;
    const job = this.download(session).finally(() =>
      this.pending.delete(session.sessionId),
    );
    this.pending.set(session.sessionId, job);
    return job;
  }

  private async download(
    session: LecturerCloudSession,
  ): Promise<LecturerCloudResult> {
    let source: string;
    try {
      const base = parseLecturerSource({
        type: "cloud",
        url: session.serverUrl,
      });
      if (base.type !== "cloud") throw Error("Invalid source");
      source = new URL(
        "lecturers",
        base.url.endsWith("/") ? base.url : `${base.url}/`,
      ).href;
    } catch {
      return { ok: false, error: "invalid_response" };
    }
    let response: { status: number; data?: unknown };
    try {
      response = await this.transport.request(session);
    } catch {
      return {
        ok: false,
        error: this.current(session) ? "network" : "session_changed",
      };
    }
    if (!this.current(session)) return { ok: false, error: "session_changed" };
    if (response.status === 401) {
      this.transport.unauthenticated(session);
      return { ok: false, error: "not_authenticated" };
    }
    if (response.status === 403) return { ok: false, error: "forbidden" };
    if (response.status !== 200) return { ok: false, error: "network" };
    let rows: { name: string; nip: string }[];
    try {
      rows = parseCloudLecturers(response.data);
    } catch {
      return { ok: false, error: "invalid_response" };
    }
    // Recheck just before the synchronous database transaction.
    if (!this.current(session)) return { ok: false, error: "session_changed" };
    try {
      return { ok: true, result: this.directory.importCloud(rows, source) };
    } catch {
      return { ok: false, error: "storage" };
    }
  }
}
