import { HasStorage } from "./concerns/has-storage";

/** Maps the account-scoped server document ID to the local document ID. */
export class DocumentAliasService extends HasStorage<Record<string, string>> {
  protected storageName = "document_id_aliases";

  static link(serverId: string, localId: string): void {
    const aliases = this.instance().storage.get() || {};
    aliases[serverId] = localId;
    this.instance().storage.set(aliases);
  }

  static resolve(serverId: string): string | undefined {
    return this.instance().storage.get()?.[serverId];
  }
}
