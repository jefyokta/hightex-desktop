export {};
declare global {
  type AuthErrorCode =
    | "request_failed"
    | "invalid_credentials"
    | "forbidden"
    | "invalid_response"
    | "invalid_callback"
    | "expired"
    | "session_changed"
    | "canceled";
  type AuthResult<T> =
    | { ok: true; data: T }
    | { ok: false; error: AuthErrorCode };
  interface BrowserLoginState {
    status: "idle" | "waiting" | "exchanging" | "failed" | "authenticated";
    expiresAt?: number;
    error?: AuthErrorCode;
  }
  interface PendingBrowserLogin {
    state: string;
    serverUrl: string;
    expiresAt: number;
  }
  interface AccountProfileData {
    session: ReviewSession;
    name: string;
    shortname?: string | null;
    nim: string | null;
    email: string;
    roles: string[];
    cv: string | null;
    picturePath: string | null;
  }
  interface AccountProfileInput {
    sessionId: string;
    cv?: string;
    image?: { bytes: Uint8Array; type: string; name: string };
  }
  type AccountResult<T> =
    | { ok: true; data: T }
    | {
        ok: false;
        error:
          | "session_changed"
          | "not_authenticated"
          | "forbidden"
          | "invalid_response"
          | "request_failed"
          | "invalid_image"
          | "validation"
          | "outcome_unknown"
          | "busy";
        fields?: Record<string, string[]>;
      };
  interface AccountAPI {
    settings(sessionId: string): Promise<AccountResult<null>>;
    load(): Promise<AccountResult<AccountProfileData>>;
    update(
      input: AccountProfileInput,
    ): Promise<AccountResult<AccountProfileData>>;
    picture(
      sessionId: string,
    ): Promise<AccountResult<{ bytes: Uint8Array; type: string } | null>>;
  }
}
