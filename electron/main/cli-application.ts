import { app } from "electron";
import { Application } from "./application";
import { CLIService } from "../service/cli-service";

const WINDOW_REQUIRED_COMMANDS = new Set([
  "compile",
  "document",
  "documents",
  "docs",
]);

export class CLIApplication {
  private readonly application = new Application();

  constructor(private readonly args: string[]) {}

  public bootstrap() {
    const [command] = this.args;

    if (!WINDOW_REQUIRED_COMMANDS.has(command)) {
      void new CLIService(this.args, null).handle().finally(() => app.quit());
      return;
    }

    const lock = app.requestSingleInstanceLock();

    if (!lock) {
      console.error(
        "HighTex is already running. Close the app before running this CLI command.",
      );
      process.exitCode = 1;
      app.quit();
      return;
    }

    app.whenReady().then(() => this.run());
  }

  private async run() {
    const [command] = this.args;

    if (WINDOW_REQUIRED_COMMANDS.has(command)) {
      await this.application.prepareCliMode();
    }

    try {
      const service = new CLIService(this.args, this.application.window);
      await service.handle();
    } finally {
      await this.application.closeCliMode();
      app.quit();
    }
  }
}
