import { app, BrowserWindow } from "electron";
import { CLIService } from "../service/cli-service";


const WINDOW_REQUIRED_COMMANDS = new Set(["compile"]);


export class CLIApplication {
  private win: BrowserWindow | null = null;

  constructor(private readonly args: string[]) {}

  public bootstrap() {
   
    app.whenReady().then(() => this.run());
  }

  private async run() {
    const [command] = this.args;

    if (WINDOW_REQUIRED_COMMANDS.has(command)) {
      await this.createHiddenWindow();
    }

    const service = new CLIService(this.args, this.win);
    await service.handle();

    app.quit();
  }

  private async createHiddenWindow() {
    this.win = new BrowserWindow({
      show: false,
      webPreferences: {
        offscreen: true,
      },
    });
  }
}