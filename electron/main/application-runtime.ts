import electron from "electron";
import "dotenv/config";

export class ApplicationRuntime {
  public static get isDev(): boolean {

    if(Boolean(process.env["HIGHTEX_MODE"] === 'production')){
      return false
    }
    return !electron.app?.isPackaged || Boolean(process.env.DEV_MODE);
  }
}
