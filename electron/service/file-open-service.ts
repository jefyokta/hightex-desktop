type FileOpenCallback = (filePath: string) => void;

export class FileOpenManager {
  private pendingFiles: string[] = [];

  private extensions: string[];

  constructor(
    private readonly callback: FileOpenCallback,
    extensions: string[] = [".hightex", ".htx", ".ht"],
  ) {
    this.extensions = extensions.map((e) =>
      e.startsWith(".") ? e.toLowerCase() : `.${e.toLowerCase()}`,
    );
  }

  bootstrap(app: Electron.App) {
    const lock = app.requestSingleInstanceLock();

    if (!lock) {
      app.quit();
      return;
    }

    app.on("open-file", (event, filePath) => {
      console.log("got file", filePath);
      event.preventDefault();

      if (!this.isSupported(filePath)) return;

      if (!app.isReady()) {
        this.pendingFiles.push(filePath);
        return;
      }

      this.emit(filePath);
    });

    app.on("second-instance", (_event, argv) => {
      const file = this.extractFromArgs(argv);

      if (!file) return;

      this.emit(file);
    });
  }

  flush() {
    for (const file of this.pendingFiles) {
      this.emit(file);
    }

    this.pendingFiles = [];

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
