import Store from "electron-store";
import { app, safeStorage, shell } from "electron";
import fs from "node:fs";
import path from "node:path";
import { ServerService } from "./server-service";

export class SessionService {
  private static cachedToken: string | null = null;
  private static store = new Store<{ "session.user"?: User|RawUser }>();

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

  static login(){
    shell.openExternal(ServerService.getServerUrl()+"auth/desktop");
  }

  static getUser(): User | undefined {
    const user =this.store.get("session.user");
    if (user && !("role" in user)) {
      (user as User).role = user.roles[0].name || "student" 
      
    }
    return user as User | undefined
  }

  static setUser(user: RawUser | User ): void {
    if (!("role" in user)) {
      (user as User).role = user.roles[0].name || "student"      
    }
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
