import { ServerUrl } from "../url/server-url";

interface AuthTransport {
  serverUrl(): string;
  request(
    serverUrl: string,
    endpoint: string,
    options?: RequestInit,
  ): Promise<{ ok: boolean; status: number; data: unknown }>;
  session(): { token?: string; user?: User };
  save(user: User, token: string, expiresAt: string): void;
  clear(): void;
  pending(): PendingBrowserLogin | undefined;
  setPending(value?: PendingBrowserLogin): void;
  broadcast(): Promise<void>;
  open(url: string): Promise<void>;
  now?(): number;
}
export const parseAccountUser = (value: unknown): User => {
  if (!value || typeof value !== "object") throw Error("invalid_response");
  const raw = value as RawUser;
  if (
    (typeof raw.id !== "string" && typeof raw.id !== "number") ||
    !String(raw.id) ||
    typeof raw.name !== "string" ||
    typeof raw.email !== "string" ||
    !Array.isArray(raw.roles) ||
    raw.roles.some((role) => !role || typeof role.name !== "string")
  )
    throw Error("invalid_response");
  return {
    ...raw,
    id: String(raw.id),
    advisors: Array.isArray(raw.advisors) ? raw.advisors : [],
    role: raw.roles[0]?.name ?? null,
  };
};
export class AuthClient {
  private generation = 0;
  private state: BrowserLoginState = { status: "idle" };
  constructor(private transport: AuthTransport) {}
  private now() {
    return this.transport.now?.() ?? Date.now();
  }
  private current(generation: number, server: string) {
    return (
      generation === this.generation && server === this.transport.serverUrl()
    );
  }
  status(): BrowserLoginState {
    if (this.state.status === "authenticated") {
      const session = this.transport.session();
      if (!session.token || !session.user) this.state = { status: "idle" };
    }
    const pending = this.transport.pending();
    if (
      pending &&
      (pending.expiresAt <= this.now() ||
        pending.serverUrl !== this.transport.serverUrl())
    ) {
      this.transport.setPending();
      this.state = { status: "failed", error: "expired" };
    } else if (pending)
      return {
        status: "waiting",
        expiresAt: pending.expiresAt,
        error: this.state.error,
      };
    return this.state;
  }
  cancel() {
    this.generation++;
    this.transport.setPending();
    this.state = { status: "idle" };
  }
  private failure(error: AuthErrorCode): AuthResult<never> {
    this.state = { status: "failed", error };
    return { ok: false, error };
  }
  async start(): Promise<AuthResult<BrowserLoginState>> {
    this.cancel();
    const generation = this.generation,
      server = this.transport.serverUrl();
    try {
      const response = await this.transport.request(server, "/auth/desktop", {
        method: "POST",
      });
      if (!this.current(generation, server))
        return { ok: false, error: "canceled" };
      if (!response.ok) return this.failure("request_failed");
      const url = new URL((response.data as { login_url: string }).login_url);
      const state = url.searchParams.get("state");
      const base = new ServerUrl(server);
      if (
        !base.compare(url) ||
        !["https:", "http:"].includes(url.protocol) ||
        url.username ||
        url.password ||
        !state ||
        !/^[a-zA-Z0-9]{64}$/.test(state) ||
        url.searchParams.getAll("state").length !== 1
      )
        return this.failure("invalid_response");
      const pending = {
        state,
        serverUrl: server,
        expiresAt: this.now() + 300000,
      };
      this.transport.setPending(pending);
      await this.transport.open(url.toString());
      if (!this.current(generation, server))
        return { ok: false, error: "canceled" };
      this.state = { status: "waiting", expiresAt: pending.expiresAt };
      return { ok: true, data: this.state };
    } catch {
      if (!this.current(generation, server))
        return { ok: false, error: "canceled" };
      this.transport.setPending();
      return this.failure("request_failed");
    }
  }
  async callback(value: string): Promise<AuthResult<User>> {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      return { ok: false, error: "invalid_callback" };
    }
    const pending = this.transport.pending();
    const state = url.searchParams.get("state"),
      code = url.searchParams.get("code");
    if (
      url.protocol !== "hightex:" ||
      url.hostname !== "auth" ||
      url.pathname !== "/callback" ||
      url.username ||
      url.password ||
      url.port ||
      !pending ||
      !state ||
      state !== pending.state ||
      !code ||
      !/^[a-zA-Z0-9]{64}$/.test(code) ||
      url.searchParams.getAll("code").length !== 1 ||
      url.searchParams.getAll("state").length !== 1
    )
      return { ok: false, error: "invalid_callback" };
    if (
      pending.expiresAt <= this.now() ||
      pending.serverUrl !== this.transport.serverUrl()
    ) {
      this.cancel();
      return this.failure("expired");
    }
    const server = pending.serverUrl,
      generation = ++this.generation;
    this.transport.setPending(); // Consume before exchange; a code is never retried automatically.
    this.state = { status: "exchanging" };
    try {
      const response = await this.transport.request(
        server,
        "/auth/desktop/exchange",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, state }),
        },
      );
      if (!this.current(generation, server))
        return { ok: false, error: "canceled" };
      if (!response.ok)
        return this.failure(
          response.status === 401 || response.status === 422
            ? "expired"
            : "request_failed",
        );
      const data = response.data as {
        token_type: string;
        access_token: string;
        expires_at: string;
        user: unknown;
      };
      if (
        data.token_type !== "Bearer" ||
        typeof data.access_token !== "string" ||
        !data.access_token ||
        !Number.isFinite(Date.parse(data.expires_at)) ||
        Date.parse(data.expires_at) <= this.now()
      )
        return this.failure("invalid_response");
      const user = parseAccountUser(data.user);
      this.transport.save(user, data.access_token, data.expires_at);
      this.state = { status: "authenticated" };
      await this.transport.broadcast();
      return { ok: true, data: user };
    } catch {
      return this.current(generation, server)
        ? this.failure("request_failed")
        : { ok: false, error: "canceled" };
    }
  }
  async login(email: string, password: string): Promise<AuthResult<User>> {
    this.cancel();
    const generation = this.generation,
      server = this.transport.serverUrl(),
      started = this.now();
    try {
      const response = await this.transport.request(server, "/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, exp: 30 * 86400 }),
      });
      if (!this.current(generation, server))
        return { ok: false, error: "canceled" };
      if (!response.ok)
        return this.failure(
          response.status === 403
            ? "forbidden"
            : [401, 422].includes(response.status)
              ? "invalid_credentials"
              : "request_failed",
        );
      const data = (response.data as { data: { user: unknown; token: string } })
        .data;
      const user = parseAccountUser(data.user);
      if (typeof data.token !== "string" || !data.token)
        return this.failure("invalid_response");
      this.transport.save(
        user,
        data.token,
        new Date(started + 30 * 86400000).toISOString(),
      );
      this.state = { status: "authenticated" };
      await this.transport.broadcast();
      return { ok: true, data: user };
    } catch {
      return this.current(generation, server)
        ? this.failure("request_failed")
        : { ok: false, error: "canceled" };
    }
  }
  async logout(): Promise<{ revoked: boolean }> {
    const { token, user } = this.transport.session(),
      server = this.transport.serverUrl();
    this.cancel();
    this.transport.clear();
    await this.transport.broadcast();
    if (!token) return { revoked: !user };
    try {
      const response = await this.transport.request(server, "/logout", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      return { revoked: response.ok || response.status === 401 };
    } catch {
      return { revoked: false };
    }
  }
}
