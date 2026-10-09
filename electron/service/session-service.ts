import Store from "electron-store";
import { app, safeStorage } from "electron";
import fs from "node:fs";
import path from "node:path";

export class SessionService {
  private static cachedToken: string | null = null;
  private static store = new Store<{ "session.user"?: User }>();

  private static get tokenPath(): string {
    return path.join(app.getPath("userData"), "session.bin");
  }

  static getToken(): string | undefined {
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

  static getUser(): User | undefined {
    return this.store.get("session.user");
  }

  static setUser(user: User): void {
    this.store.set("session.user", user);
  }

  static clearUser(): void {
    this.store.delete("session.user");
  }

  static clear(): void {
    this.deleteToken();
    this.clearUser();
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
