import { Chapter } from "@/editor/chapter";
import { CiteUtils } from "bibtex.js";

export {};

declare global {
  type ThemeMode = "light" | "dark" | "system";
  interface Profile {
    name: string;
    nim: string;
    advisorName: string;
    advisorNip: string;
  }

  interface DocumentProfile extends Profile {
    isCloud: boolean;
  }

  interface ProfileAPI {
    get: () => Promise<Profile>;
    set: (profile: Partial<Profile>) => Promise<Profile>;
    reset: () => Promise<void>;
  }
  type ConfigShape = {
    theme: ThemeMode;

    previewer: {
      autoUpdate: boolean;
      layoutIndicator: boolean;
      scope: "full" | "current";
    };

    scanner: {
      autoUpdate: boolean;
      /**
       * @deprecated
       * its always all now
       */
      scope: "current" | "all";
    };
    editor: {
      spellCheck?: boolean;
      preferCloudProfile?: boolean;
    };
    export: {
      saveDialog: boolean;
      saveFolder: string;
    };
    zotero: {
      enabled: boolean;
      host: string;
      port: number;
    };
  };

  interface ConfigAPI {
    get(): ConfigShape | null;
    ready(): Promise<ConfigShape>;

    set(patch: Partial<ConfigShape>): Promise<ConfigShape>;
    reset(): Promise<ConfigShape>;

    key<K extends keyof ConfigShape>(key: K): Promise<ConfigShape[K]>;

    onChange(cb: (config: ConfigShape) => void): () => void;
  }

  interface ZoteroItem {
    key: string;
    title: string;
    itemType?: string;
    creators?: Array<{
      creatorType: string;
      firstName?: string;
      lastName?: string;
      name?: string;
    }>;
    date?: string;
    url?: string;
  }

  interface ZoteroConnectionResult {
    connected: boolean;
    message: string;
    host: string;
    port: number;
  }

  interface ZoteroAPI {
    testConnection(host: string, port: number): Promise<ZoteroConnectionResult>;
    listItems(
      host: string,
      port: number,
      limit?: number,
    ): Promise<ZoteroItem[]>;
    exportBibtex(host: string, port: number, itemKey: string): Promise<string>;
  }
type ExportPayload = {
  title?: string;
  author?: string;
  chapters?: { chapter: number; page: number }[];
  hasWm?: boolean;
}
  interface PluginScannerAPI {
    paragraph(
      pluginId: string,

      text: string,

      context: ScannerContext,
    ): Promise<TextError[]>;

    node(
      pluginId: string,

      node: JSONContent,

      context: ScannerContext,
    ): Promise<NodeError[]>;
    all(): Promise<SerialableHightexPlugin[]>;
  }

  interface Window {
    session: {
      user(): Promise<User | false>;
      login(email: string, password: string): Promise<User | false>;
      logout(): Promise<void>;
      onChange?: (cb: (u: User | false) => void) => () => void;
    };

    hightex: {
      document(): Promise<{ document: HighTexDocument }>;
      prefetch(): Promise<void>;
      onPrefetchProgress(cb: (data: any) => void): void;
      onPdfProgress(cb: (data: { status: string; progress?: number }) => void): () => void;
      categories(): Promise<Category[]>;
      profile(): Promise<DocumentProfile>;
    };

    config: ConfigAPI;
    zotero: ZoteroAPI;

    plugin: { scanner: PluginScannerAPI };
    //cmn ada di frame yach
    inFrame: boolean;
    current: Chapter;
    cites: CiteRecord[];
    profile: ProfileAPI;
    dialog: {
      selectFolder(): Promise<string | undefined>;
    };
  }
}
