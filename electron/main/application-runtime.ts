import electron from "electron";
import "dotenv/config";

export class ApplicationRuntime {
  public static get isDev(): boolean {
    return !electron.app?.isPackaged || Boolean( process.env.DEV_MODE );
  }
}
