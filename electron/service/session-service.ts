import Store from "electron-store";
import { app, safeStorage } from "electron";
import fs from "node:fs";
import path from "node:path";
import { ServerService } from "./server-service";

export class SessionService {
  private static cachedToken: string | null = null;
  private static expiryTimer?: ReturnType<typeof setTimeout>;
  static onExpired?: () => void;
  private static armExpiry(value: string) {
    clearTimeout(this.expiryTimer);
    const remaining = Date.parse(value) - Date.now();
    if (!Number.isFinite(remaining)) return;
    this.expiryTimer = setTimeout(
      () => {
        if (Date.parse(value) > Date.now()) this.armExpiry(value);
        else {
          this.clear();
          this.onExpired?.();
        }
      },
      Math.max(1, Math.min(remaining, 2147483647)),
    );
    this.expiryTimer.unref?.();
  }
  private static store = new Store<{
    "session.user"?: User | RawUser;
    "session.expiresAt"?: string;
    "session.serverUrl"?: string;
    "session.browser"?: PendingBrowserLogin;
  }>();

  private static get tokenPath(): string {
    return path.join(app.getPath("userData"), "session.bin");
  }

  static getToken(): string | undefined {
    const expiry = this.store.get("session.expiresAt") as string | undefined;
    const server = this.store.get("session.serverUrl") as string | undefined;
    if (
      (expiry && Date.parse(expiry) <= Date.now()) ||
      (server && server !== ServerService.getServerUrl())
    ) {
      this.clear();
      this.onExpired?.();
      return undefined;
    }
    if (expiry) this.armExpiry(expiry);
    if (this.cachedToken) return this.cachedToken;

    try {
      const enc = fs.readFileSync(this.tokenPath);
      this.cachedToken = safeStorage.decryptString(enc);
      return this.cachedToken;
    } catch {
      this.deleteToken();
      return undefined;
    }
  }

  static setToken(token: string): void {
    if (!this.canEncrypt()) {
      throw new Error("OS doesnt support encryption");
    }
    fs.writeFileSync(this.tokenPath, safeStorage.encryptString(token), {
      mode: 0o600,
    });
    this.cachedToken = token;
  }

  static deleteToken(): void {
    this.cachedToken = null;
    fs.rmSync(this.tokenPath, { force: true });
  }

  static setExpiry(expiresAt: string) {
    this.store.set("session.expiresAt", expiresAt);
    this.armExpiry(expiresAt);
    this.store.set("session.serverUrl", ServerService.getServerUrl());
  }
  static pendingBrowser() {
    return this.store.get("session.browser");
  }
  static setPendingBrowser(value?: PendingBrowserLogin) {
    if (value) this.store.set("session.browser", value);
    else this.store.delete("session.browser");
  }

  static getUser(): User | undefined {
    const user = this.store.get("session.user");
    if (user && !("role" in user)) {
      (user as User).role = user.roles?.[0]?.name ?? null;
    }
    return user as User | undefined;
  }

  static setUser(user: RawUser | User): void {
    if (!("role" in user)) {
      (user as User).role = user.roles?.[0]?.name ?? null;
    }
    this.store.set("session.user", user);
  }

  static clearUser(): void {
    this.store.delete("session.user");
  }

  static clear(): void {
    clearTimeout(this.expiryTimer);
    this.deleteToken();
    this.clearUser();
    this.store.delete("session.expiresAt");
    this.store.delete("session.serverUrl");
  }

  private static canEncrypt(): boolean {
    if (!safeStorage.isEncryptionAvailable()) return false;
    if (
      process.platform === "linux" &&
      safeStorage.getSelectedStorageBackend() === "basic_text"
    ) {
      return false;
    }
    return true;
  }
}
