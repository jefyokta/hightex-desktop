import type {
  AppUpdater,
  ProgressInfo,
  UpdateDownloadedEvent,
  UpdateInfo,
} from "electron-updater";

export type UpdaterStatus =
  | { status: "disabled"; reason: string; manual: boolean }
  | { status: "checking"; manual: boolean }
  | { status: "available"; info: UpdateInfo; manual: boolean }
  | { status: "not-available"; info: UpdateInfo; manual: boolean }
  | { status: "downloading"; progress: ProgressInfo; manual: boolean }
  | {
      status: "downloaded";
      info: UpdateDownloadedEvent;
      manual: boolean;
      retry?: boolean;
    }
  | { status: "installing"; manual: boolean }
  | { status: "error"; message: string; manual: boolean };

export interface InstallResult {
  ok: boolean;
  cancelled?: boolean;
  message?: string;
}
export interface InstallContext {
  profileSaving(): boolean;
  prepareEditors(): Promise<boolean>;
  quitting(): void;
}
export interface PlatformUpdater {
  readonly client: AppUpdater;
  install(context: InstallContext): Promise<"quitting" | "cancelled">;
  cancel(): void;
  didQuit(): void;
  acknowledgeStartup(version: string): Promise<string | undefined>;
}
