import { DeepLinkService } from "./deep-link-service";

type FileOpenCallback = (filePath: string) => void;
type CliOpenCallback = (args: string[]) => void | Promise<void>;

export class FileOpenManager {
  private pendingFiles: string[] = [];
  private pendingLinks: string[] = [];

  private extensions: string[];

  constructor(
    private readonly callback: FileOpenCallback,
    private readonly onCli?: CliOpenCallback,
    extensions: string[] = [".hightex", ".hts", ".ht"],
  ) {
    this.extensions = extensions.map((e) =>
      e.startsWith(".") ? e.toLowerCase() : `.${e.toLowerCase()}`,
    );
  }

  static isDocumentFile(filepath: string) {
    return filepath.endsWith(".hightex");
  }

  bootstrap(app: Electron.App) {
    const lock = app.requestSingleInstanceLock();

    if (!lock) {
      app.quit();
      return;
    }

    app.on("open-file", (event, filePath) => {
      event.preventDefault();

      if (!this.isSupported(filePath)) return;

      if (!app.isReady()) {
        this.pendingFiles.push(filePath);
        return;
      }

      this.emit(filePath);
    });

    app.on("second-instance", (_event, argv) => {
      const deeplink = DeepLinkService.isDeepLink(argv);
      if (deeplink) {
        if (!app.isReady()) {
          this.pendingLinks.push(deeplink.toString());
          return;
        }
        void Promise.resolve(deeplink.handle()).catch(() => {});
        return;
      }
      const file = this.extractFromArgs(argv);
      if (!file) {
        void this.onCli?.(argv);
        return;
      }

      this.emit(file);
    });
  }

  flush() {
    for (const url of this.pendingLinks.splice(0))
      void new DeepLinkService(url).handle().catch(() => {});
    for (const file of this.pendingFiles) {
      this.emit(file);
    }

    this.pendingFiles = [];

    const startupLink = DeepLinkService.isDeepLink(process.argv);
    if (startupLink) void Promise.resolve(startupLink.handle()).catch(() => {});
    const startupFile = this.extractFromArgs(process.argv);

    if (startupFile) {
      this.emit(startupFile);
    }
  }

  private emit(filePath: string) {
    try {
      this.callback(filePath);
    } catch (error) {
      console.error(
        "[FileOpenManager] Failed to handle file:",
        filePath,
        error,
      );
    }
  }

  private extractFromArgs(args: string[]) {
    return args.find((arg) => this.isSupported(arg));
  }

  private isSupported(filePath: string) {
    const lower = filePath.toLowerCase();

    return this.extensions.some((ext) => lower.endsWith(ext));
  }
}
