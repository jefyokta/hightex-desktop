import { Handled } from "@main/exception/interface/handled";
import { ipcMain, IpcMainInvokeEvent } from "electron";

export class IPCMain {
  static handle(
    channel: string,
    listener: (event: IpcMainInvokeEvent, ...args: any[]) => Promise<any> | any,
  ) {
    ipcMain.handle(channel, async (event, ...args) => {
      try {
        return await listener(event, ...args);
      } catch (error) {
        if (error instanceof Handled) {
          error.handle();
        }

        throw error;
      }
    });
  }
}
