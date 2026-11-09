import { AppUpdater, type ResolvedUpdateFileInfo } from "electron-updater";
import type { DownloadUpdateOptions } from "electron-updater/out/AppUpdater.js";
import { ElectronHttpExecutor } from "electron-updater/out/electronHttpExecutor.js";

export interface MacUpdateArtifact {
  file: string;
  version: string;
  sha512: string;
}

export function selectMacInstaller(
  files: ResolvedUpdateFileInfo[],
  arch: string,
) {
  const candidates = files.filter((file) => {
    const name = decodeURIComponent(file.url.pathname).toLowerCase();
    if (!name.endsWith(".dmg")) return false;
    if (arch === "arm64") return !/(?:x64|x86_64|amd64)/.test(name);
    return !/(?:arm64|aarch64)/.test(name);
  });
  const selected =
    candidates.find((file) =>
      new RegExp(arch === "arm64" ? "arm64|aarch64" : "x64|x86_64|amd64").test(
        file.url.pathname.toLowerCase(),
      ),
    ) ?? candidates[0];
  if (!selected?.info.sha512)
    throw Error("A compatible macOS installer with a checksum is unavailable.");
  return selected;
}

/** Reuse release metadata, progress, caching and checksums without invoking Squirrel.Mac. */
export class MacManualUpdater extends AppUpdater {
  private artifact: MacUpdateArtifact | null = null;
  private readonly downloader = new ElectronHttpExecutor((info, callback) =>
    this.emit("login", info, callback),
  );

  constructor() {
    super(undefined);
    this.autoDownload = false;
    this.autoInstallOnAppQuit = false;
  }

  protected async doDownloadUpdate(options: DownloadUpdateOptions) {
    const { info, provider } = options.updateInfoAndProvider;
    const file = selectMacInstaller(provider.resolveFiles(info), process.arch);
    this.artifact = null;
    return this.executeDownload({
      fileExtension: "dmg",
      fileInfo: file,
      downloadUpdateOptions: options,
      task: (destination, downloadOptions) =>
        this.downloader.download(file.url, destination, downloadOptions),
      done: async (event) => {
        this.artifact = {
          file: event.downloadedFile,
          version: event.version,
          sha512: file.info.sha512,
        };
        this.dispatchUpdateDownloaded(event);
      },
    });
  }

  downloadedArtifact(): MacUpdateArtifact {
    if (!this.artifact) throw Error("The update has not finished downloading.");
    return this.artifact;
  }

  quitAndInstall(): void {
    throw Error(
      "macOS installation must use the staged application installer.",
    );
  }
}
