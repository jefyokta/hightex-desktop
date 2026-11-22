import type { ZoteroConnectionResult, ZoteroItem } from "../../shared/zotero-contract";
import {
  buildZoteroItemBibtexUrl,
  buildZoteroItemListUrl,
  buildZoteroSearchUrl,
  buildZoteroTestUrl,
  parseZoteroItems,
} from "../utilities/zotero";

type ZoteroFetch = (url: string) => Promise<Response>;

/** HTTP access to one configured Zotero Desktop endpoint. */
export class ZoteroService {
  constructor(
    private readonly host: string,
    private readonly port: number,
    private readonly fetch: ZoteroFetch = globalThis.fetch,
  ) {}

  listItems(limit = 100): Promise<ZoteroItem[]> {
    return this.getItems(buildZoteroItemListUrl(this.host, this.port, limit));
  }

  searchItems(query: string): Promise<ZoteroItem[]> {
    return this.getItems(buildZoteroSearchUrl(this.host, this.port, query));
  }

  async exportBibtex(key: string): Promise<string> {
    const response = await this.get(buildZoteroItemBibtexUrl(this.host, this.port, key));
    return response.text();
  }

  async testConnection(): Promise<ZoteroConnectionResult> {
    const endpoint = { host: this.host, port: this.port };
    try {
      const response = await this.fetch(buildZoteroTestUrl(this.host, this.port));
      if (!response.ok) {
        return {
          ...endpoint,
          connected: false,
          message: `Zotero returned ${response.status} ${response.statusText}`,
        };
      }
      await response.json();
      return { ...endpoint, connected: true, message: "Connected to Zotero local API." };
    } catch {
      return {
        ...endpoint,
        connected: false,
        message: "Zotero connection failed. Please ensure Zotero Desktop is running and local API access is enabled in Settings.",
      };
    }
  }

  private async getItems(url: string): Promise<ZoteroItem[]> {
    const response = await this.get(url);
    return parseZoteroItems(await response.json());
  }

  private async get(url: string): Promise<Response> {
    const response = await this.fetch(url);
    if (!response.ok) {
      throw new Error(`Zotero returned ${response.status} ${response.statusText}`);
    }
    return response;
  }
}
