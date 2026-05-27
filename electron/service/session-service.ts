import Store from "electron-store";

export class SessionService {
  static store = new Store<{
    "session.token"?: string;
    "session.user"?: User;
  }>();

  static getToken(): string | undefined {
    return this.store.get("session.token");
  }

  static setToken(token: string): void {
    this.store.set("session.token", token);
  }

  static deleteToken(): void {
    this.store.delete("session.token");
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
}
