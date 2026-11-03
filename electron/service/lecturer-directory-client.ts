export const DIRECTORY_REFRESH_MS = 24 * 60 * 60 * 1000;
const RETRY_MS = 5 * 60 * 1000;

interface DirectoryCache extends LecturerDirectoryPayload {
  source: string;
  checkedAt: number | null;
  fromSeed: boolean;
  etag: string;
}
interface DirectoryTransport {
  source(): string;
  read(source: string): unknown;
  write(source: string, cache: DirectoryCache): void;
  seed: unknown;
  request(
    source: string,
    etag: string | null,
  ): Promise<{ status: number; body?: unknown; etag?: string | null }>;
  now(): number;
}

const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Invalid directory");
  return value as Record<string, unknown>;
};
export function parseLecturerDirectory(
  value: unknown,
): LecturerDirectoryPayload {
  const raw = record(value);
  if (
    raw.schema_version !== 1 ||
    typeof raw.version !== "string" ||
    !/^[a-f0-9]{64}$/.test(raw.version) ||
    !Array.isArray(raw.data) ||
    raw.data.length > 10000
  )
    throw Error("Invalid directory");
  const ids = new Set<string>();
  const data = raw.data.map((value) => {
    const row = record(value);
    if (
      typeof row.id !== "string" ||
      !row.id.trim() ||
      row.id.length > 200 ||
      ids.has(row.id) ||
      typeof row.name !== "string" ||
      !row.name.trim() ||
      row.name.length > 500 ||
      typeof row.nip !== "string" ||
      row.nip.length > 200
    )
      throw Error("Invalid lecturer");
    ids.add(row.id);
    return { id: row.id, name: row.name, nip: row.nip };
  });
  return { schema_version: 1, version: raw.version, data };
}

/** Cache first, independent of login. A failed refresh never replaces a good snapshot. */
export class LecturerDirectoryClient {
  private pending = new Map<string, Promise<LecturerDirectoryState>>();
  private lastAttempt = new Map<string, number>();
  constructor(private transport: DirectoryTransport) {}

  private cache(source: string): DirectoryCache | null {
    try {
      const raw = record(this.transport.read(source));
      const payload = parseLecturerDirectory(raw);
      if (
        raw.source === source &&
        (raw.checkedAt === null ||
          (typeof raw.checkedAt === "number" &&
            Number.isFinite(raw.checkedAt))) &&
        typeof raw.fromSeed === "boolean"
      ) {
        return {
          ...payload,
          source,
          checkedAt: raw.checkedAt as number | null,
          fromSeed: raw.fromSeed,
          etag: `"${payload.version}"`,
        };
      }
    } catch {
      /* Fall back to the bundled directory. */
    }
    try {
      const seed = record(this.transport.seed);
      if (seed.source !== source) return null;
      return {
        ...parseLecturerDirectory(seed),
        source,
        checkedAt: null,
        fromSeed: true,
        etag: `"${seed.version}"`,
      };
    } catch {
      return null;
    }
  }
  private state(
    source: string,
    cache: DirectoryCache | null,
  ): LecturerDirectoryState {
    return {
      source,
      data: cache?.data ?? [],
      version: cache?.version ?? null,
      checkedAt: cache?.checkedAt ?? null,
      fromSeed: cache?.fromSeed ?? false,
    };
  }
  cached(): LecturerDirectoryState {
    const source = this.transport.source();
    return this.state(source, this.cache(source));
  }
  refresh(force = false): Promise<LecturerDirectoryState> {
    const source = this.transport.source();
    const pending = this.pending.get(source);
    if (pending) return pending;
    const cache = this.cache(source);
    const now = this.transport.now();
    if (
      !force &&
      ((cache?.checkedAt != null &&
        now - cache.checkedAt < DIRECTORY_REFRESH_MS) ||
        (this.lastAttempt.has(source) &&
          now - this.lastAttempt.get(source)! < RETRY_MS))
    )
      return Promise.resolve(this.state(source, cache));
    this.lastAttempt.set(source, now);
    const job = this.update(source, cache).finally(() =>
      this.pending.delete(source),
    );
    this.pending.set(source, job);
    return job;
  }
  private async update(
    source: string,
    previous: DirectoryCache | null,
  ): Promise<LecturerDirectoryState> {
    let response: Awaited<ReturnType<DirectoryTransport["request"]>>;
    try {
      response = await this.transport.request(source, previous?.etag ?? null);
    } catch {
      return { ...this.state(source, previous), error: "network" };
    }
    if (this.transport.source() !== source) return this.cached();
    if (response.status !== 200 && response.status !== 304)
      return { ...this.state(source, previous), error: "network" };
    let next: DirectoryCache;
    try {
      if (response.status === 304) {
        if (!previous) throw Error("Missing cache");
        next = {
          ...previous,
          checkedAt: this.transport.now(),
          fromSeed: false,
        };
      } else {
        const payload = parseLecturerDirectory(response.body);
        next = {
          ...payload,
          source,
          checkedAt: this.transport.now(),
          fromSeed: false,
          etag: `"${payload.version}"`,
        };
      }
    } catch {
      return { ...this.state(source, previous), error: "invalid" };
    }
    try {
      this.transport.write(source, next);
    } catch {
      return { ...this.state(source, previous), error: "storage" };
    }
    return this.state(source, next);
  }
}
