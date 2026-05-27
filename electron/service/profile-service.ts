import Store from "electron-store";

export class ProfileService {
  static store = new Store<{ profile: Profile }>();

  private static default(): Profile {
    return {
      name: "Guest",
      nim: "12250xxxx",
      advisorName: "Advisor",
      advisorNip: "1111",
    };
  }

  static get(): Profile {
    return this.store.get("profile") ?? this.default();
  }

  static set(profile: Partial<Profile>) {
    const current = this.get();

    const updated: Profile = {
      ...current,
      ...profile,
    };

    this.store.set("profile", updated);

    return updated;
  }

  static clear() {
    this.store.set("profile", this.default());
  }
}
