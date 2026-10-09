import { ImportWindow } from "@main/windows/import-window";

type CliOpenCallback = (args: string[]) => void | Promise<void>;

export class FileOpenManager {

  private extensions: string[] = [".hightex", ".hts", ".ht"];

  constructor(
    private readonly onCli?: CliOpenCallback,
  ) {

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
      this.emit(filePath);
    });

    app.on("second-instance", (_event, argv) => {
      const file = this.extractFromArgs(argv);

      if (!file) {
        void this.onCli?.(argv);
        return;
      }

      this.emit(file);
    });
  }

 async flush() {
    await ImportWindow.instance.load()
  }

  private emit(filePath: string) {
    if(filePath.endsWith(".hightex")){
      ImportWindow.instance.addFiles(filePath)
      return
    }
    console.warn("unsupported file %s",filePath.split("/").slice(-1))
    
  }

  private extractFromArgs(args: string[]) {
    return args.find((arg) => this.isSupported(arg));
  }

  private isSupported(filePath: string) {
    const lower = filePath.toLowerCase();

    return this.extensions.some((ext) => lower.endsWith(ext));
  }
}
