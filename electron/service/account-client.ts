import { parseAccountUser } from "./auth-client";
import { ServerUrl } from "../url/server-url";
interface AccountTransport {
  context(): SubmissionResult<ReviewSession>;
  request(
    endpoint: string,
    options?: RequestInit,
  ): Promise<{ ok: boolean; status: number; data: unknown }>;
  image(url: string): Promise<{ ok: boolean; type: string; bytes: Uint8Array }>;
  accept(user: User): Promise<void>;
  open(url: string): Promise<void>;
}
class AccountError extends Error {
  constructor(
    readonly code: Exclude<AccountResult<never>, { ok: true }>["error"],
    readonly fields?: Record<string, string[]>,
  ) {
    super(code);
  }
}
export class AccountClient {
  private writing = false;
  private cache = new Map<string, AccountProfileData>();
  constructor(private transport: AccountTransport) {}
  private context(sessionId?: string) {
    const result = this.transport.context();
    if (!result.ok) throw new AccountError("not_authenticated");
    if (sessionId && result.data.sessionId !== sessionId)
      throw new AccountError("session_changed");
    return result.data;
  }
  private async result<T>(action: () => Promise<T>): Promise<AccountResult<T>> {
    try {
      return { ok: true, data: await action() };
    } catch (cause) {
      return {
        ok: false,
        error: cause instanceof AccountError ? cause.code : "request_failed",
        ...(cause instanceof AccountError && cause.fields
          ? { fields: cause.fields }
          : {}),
      };
    }
  }
  private parse(
    value: unknown,
    session: ReviewSession,
  ): { profile: AccountProfileData; user: User } {
    let user: User;
    try {
      user = parseAccountUser((value as { message: unknown }).message);
    } catch {
      throw new AccountError("invalid_response");
    }
    if (user.id !== session.accountId)
      throw new AccountError("session_changed");
    const raw = user as User & {
      shortname?: unknown;
      cv?: unknown;
      picture?: { path?: unknown } | null;
    };
    if (raw.cv !== undefined && raw.cv !== null && typeof raw.cv !== "string")
      throw new AccountError("invalid_response");
    const picturePath = raw.picture?.path;
    if (
      picturePath !== undefined &&
      (typeof picturePath !== "string" ||
        !/^profile-pictures\/profile-[a-zA-Z0-9_-]+\.(png|jpe?g|webp)$/.test(
          picturePath,
        ))
    )
      throw new AccountError("invalid_response");
    return {
      user,
      profile: {
        session,
        name: user.name,
        shortname: typeof raw.shortname === "string" ? raw.shortname : null,
        nim:
          typeof user.identity_number === "string"
            ? user.identity_number
            : null,
        email: user.email,
        roles: user.roles.map((role) => role.name),
        cv: typeof raw.cv === "string" ? raw.cv : null,
        picturePath: typeof picturePath === "string" ? picturePath : null,
      },
    };
  }
  private check(response: { ok: boolean; status: number; data: unknown }) {
    if (response.ok) return;
    const fields = (response.data as { errors?: Record<string, unknown> })
      ?.errors;
    const safeFields =
      fields &&
      (Object.fromEntries(
        Object.entries(fields).filter(
          ([, value]) =>
            Array.isArray(value) &&
            value.every((item) => typeof item === "string"),
        ),
      ) as Record<string, string[]> | undefined);
    throw new AccountError(
      response.status === 401
        ? "not_authenticated"
        : response.status === 403
          ? "forbidden"
          : response.status === 422
            ? "validation"
            : "request_failed",
      safeFields,
    );
  }
  settings(sessionId: string): Promise<AccountResult<null>> {
    return this.result(async () => {
      const session = this.context(sessionId);
      await this.transport.open(
        new ServerUrl(session.serverUrl).resolve("/profile/update").href,
      );
      return null;
    });
  }
  load(): Promise<AccountResult<AccountProfileData>> {
    return this.result(async () => {
      const session = this.context();
      const response = await this.transport.request("/me");
      this.context(session.sessionId);
      this.check(response);
      const { profile } = this.parse(response.data, session);
      this.cache.clear();
      this.cache.set(session.sessionId, profile);
      return profile;
    });
  }
  update(
    input: AccountProfileInput,
  ): Promise<AccountResult<AccountProfileData>> {
    return this.result(async () => {
      const session = this.context(input.sessionId);
      if (this.writing) throw new AccountError("busy");
      if (input.cv !== undefined && typeof input.cv !== "string")
        throw new AccountError("validation");
      if (
        input.image &&
        (!(input.image.bytes instanceof Uint8Array) ||
          input.image.bytes.length > 2 * 1024 * 1024 ||
          !input.image.bytes.length ||
          !["image/png", "image/jpeg", "image/webp"].includes(input.image.type))
      )
        throw new AccountError("invalid_image");
      if (input.cv === undefined && !input.image)
        throw new AccountError("validation");
      const body = new FormData();
      if (input.cv !== undefined) body.set("cv", input.cv);
      if (input.image)
        body.set(
          "image",
          new Blob([input.image.bytes.slice().buffer], {
            type: input.image.type,
          }),
          input.image.name.replace(/[^a-zA-Z0-9._-]/g, "_"),
        );
      this.writing = true;
      try {
        let response;
        try {
          response = await this.transport.request("/profile", {
            method: "POST",
            body,
          });
        } catch {
          this.context(session.sessionId);
          throw new AccountError("outcome_unknown");
        }
        this.context(session.sessionId);
        if (response.status >= 500) throw new AccountError("outcome_unknown");
        this.check(response);
        const { profile, user } = this.parse(response.data, session);
        await this.transport.accept(user);
        this.context(session.sessionId);
        this.cache.clear();
        this.cache.set(session.sessionId, profile);
        return profile;
      } finally {
        this.writing = false;
      }
    });
  }
  picture(
    sessionId: string,
  ): Promise<AccountResult<{ bytes: Uint8Array; type: string } | null>> {
    return this.result(async () => {
      const session = this.context(sessionId);
      const cached = this.cache.get(sessionId);
      if (!cached) throw new AccountError("invalid_response");
      if (!cached.picturePath) return null;
      const url = new ServerUrl(session.serverUrl).resolve(
        `/storage/${cached.picturePath}`,
      );
      const response = await this.transport.image(url.toString());
      this.context(sessionId);
      if (
        !response.ok ||
        !["image/png", "image/jpeg", "image/webp"].includes(response.type) ||
        response.bytes.length > 2 * 1024 * 1024
      )
        throw new AccountError("invalid_image");
      return { bytes: response.bytes, type: response.type };
    });
  }
}
