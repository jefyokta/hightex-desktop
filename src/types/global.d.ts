import { Chapter } from "@/editor/chapter";
import { SnapshotRelation } from "@main/database/models/snapshot";
import { JSONContent } from "@tiptap/core";
import { CiteUtils } from "bibtex.js";

export {};

declare global {
  type Promisable<T = void> = T | Promise<T>;
  type ThemeMode = "light" | "dark" | "system";
  type SupportedLanguage = "en" | "id";

  interface LegacyProfile {
    name: string;
    nim: string;
    advisorName: string;
    advisorNip: string;
    secondAdvisor?: {
      name: string;
      nip: string;
    };
  }
  interface Profile extends LegacyProfile {
    cv: string;
  }

  interface AuthorProfile extends Profile {
    picture?: Blob;
  }

  interface DocumentProfile extends AuthorProfile {
    isCloud: boolean;
    incomplete?: boolean;
  }

  interface ProfileAPI {
    get: () => Promise<Profile>;
    set: (profile: Partial<Profile>) => Promise<Profile>;
    reset: () => Promise<void>;
    picture: () => Promise<Uint8Array | false>;
    setPicture: (blob: Uint8Array) => Promise<any>;
  }
  type ConfigShape = {
    language: SupportedLanguage;
    theme: ThemeMode;

    previewer: {
      autoUpdate: boolean;
      layoutIndicator: boolean;
      scope: "full" | "current";
    };

    editor: {
      spellCheck?: boolean;
      preferCloudProfile?: boolean;
      scrollBar?: boolean;
      aliasHint?: boolean;
      tableResizeGuides?: boolean;
    };
    export: {
      saveDialog: boolean;
      saveFolder: string;
      exportTimeout?: number;
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
  type ExportPayloadChapter = { chapter: number; page: number };
  type ExportPayload = {
    title?: string;
    author?: string;
    chapters?: ExportPayloadChapter[];
    hasWm?: boolean;
    keywords?: string[];
    detail: Record<number, { start: number; end: number }>;
  };
  interface Window {
    account: AccountAPI;
    snapshotPrint: SnapshotPrintAPI;
    session: {
      signIn(email: string, password: string): Promise<AuthResult<User>>;
      browser: {
        start(): Promise<AuthResult<BrowserLoginState>>;
        status(): Promise<BrowserLoginState>;
        cancel(): Promise<void>;
      };
      user(): Promise<User | false>;
      login(email: string, password: string): Promise<User | false>;
      logout(): Promise<{ revoked: boolean }>;
      onChange?: (cb: (u: User | false) => void) => () => void;
    };
    file: FileApi;
    editor: EditorAPI;
    hightex: {
      submission: {
        pdf(input: SnapshotPDFInput): Promise<{ path: string } | null>;
        advisor: AdvisorAPI;
        context(): Promise<SubmissionResult<ReviewSession>>;
        list(): Promise<SubmissionResult<SubmissionList>>;
        history(input: {
          sessionId: string;
          documentId: string;
        }): Promise<SubmissionResult<SubmissionHistory>>;
        detail(input: {
          sessionId: string;
          documentId: string;
          submissionId: string;
        }): Promise<SubmissionResult<SubmissionDetail>>;
        workflow: SubmissionWorkflowAPI;
        file(input: {
          sessionId: string;
          submissionId: string;
          documentId: string;
        }): Promise<SubmissionResult<SubmissionSnapshot>>;
      };
      document(): Promise<{ document: HighTexDocument }>;
      prefetch(): Promise<void>;
      onPrefetchProgress(cb: (data: any) => void): void;
      onPdfProgress(
        cb: (data: { status: string; progress?: number }) => void,
      ): () => void;
      categories(): Promise<Category[]>;
      profile(): Promise<DocumentProfile>;
      onOpenFile(cb: (file: string) => void): () => void;
      readFile(filePath: string): Promise<NonSharedBuffer>;
      category(id: string): Promise<Category>;
      version(): Promise<string>;
      reportError(payload: {
        title: string;
        description: string;
      }): Promise<unknown>;
      saveContentError(props: {
        content: JSONContent;
        fileName: string;
        error?: any;
      }): Promise<void>;
      snapshot: SnapshotApi;
      cloud: CloudAPI;
    };

    config: ConfigAPI;
    zotero: ZoteroAPI;
    sharing: SharingAPI;
    //cmn ada di frame yach
    /**
     * @deprecated
     */
    inFrame: boolean;
    current: Chapter;
    cites: CiteRecord[];
    profile: ProfileAPI;
    dialog: {
      selectFolder(): Promise<string | undefined>;
    };
    updater: {
      check(): Promise<UpdaterStatus>;
      install(): Promise<{ ok: boolean; message?: string }>;
      onStatus(cb: (status: UpdaterStatus) => void): () => void;
      download(): Promise<void>;
    };
    confirm: (msg: string) => Promise<boolean>;
    alert: (msg: string) => Promise<void>;
  }

  type UpdaterStatus =
    | { status: "disabled"; reason: string; manual: boolean }
    | { status: "checking"; manual: boolean }
    | { status: "available"; info: UpdaterInfo; manual: boolean }
    | { status: "not-available"; info: UpdaterInfo; manual: boolean }
    | { status: "downloading"; progress: UpdaterProgress; manual: boolean }
    | { status: "downloaded"; info: UpdaterDownloadedInfo; manual: boolean }
    | { status: "error"; message: string; manual: boolean };

  interface UpdaterInfo {
    version: string;
    releaseName?: string | null;
    releaseNotes?: string | unknown[] | null;
    releaseDate: string;
  }

  interface UpdaterDownloadedInfo extends UpdaterInfo {
    downloadedFile: string;
  }

  interface UpdaterProgress {
    total: number;
    delta: number;
    transferred: number;
    percent: number;
    bytesPerSecond: number;
  }

  interface SharingAPI {
    stop(): Promisevoid<void>;
    start(
      payload: SharingPayload,
    ): Promise<
      Omit<SharingInformation, "document"> | { message: string; name: string }
    >;
    info(): Promise<SharingInformation | undefined>;
    html(id: string): Promise<Snapshot>;
    getSnapshot(): Promise<Snapshot>;
    wifi: {
      current(): Promise<WifiInformation | null>;
      connect(
        ssid: string,
        pass: string,
      ): Promise<{
        changed: boolean;
        network: WifiInformation;
      }>;
      scan(): Promise<WifiInformation[]>;
    };
  }

  interface SnapshotApi {
    document(
      documentId: string,
    ): Promise<WithRelation<SnapshotEntity, SnapshotRelation, "comments">[]>;
    all(): Promise<
      WithRelation<SnapshotEntity, SnapshotRelation, "comments">[]
    >;
    get(
      snapId: string,
    ): Promise<
      WithRelation<SnapshotEntity, SnapshotRelation, "comments"> | undefined
    >;
  }

  interface FileApi {
    save(fileName: string, file: Uint8Array): Promise<string>;
    openPath(path: string): Promise<string>;
    showInFolder(path: string): Promise<void>;
    openFolder(folderPath: string): Promise<void>;
    getPath(file: File): Promise<string>;
    getUserDataPath(): Promise<string>;
  }

  interface EditorAPI {
    open(documentId: string, file?: string): Promise<void>;
    has(documentId: string): Promise<boolean>;
    save(buffer: Uint8Array, fileName: string): Promise<string | undefined>;
  }
}
