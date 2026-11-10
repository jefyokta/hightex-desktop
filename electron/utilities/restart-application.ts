import { app } from "electron";
import { ApplicationRuntime } from "../main/application-runtime";

export async function restartApplication(): Promise<void> {
  if (
    ApplicationRuntime.isDev &&
    process.env.VITE_DEV_SERVER_URL &&
    process.connected &&
    process.send
  ) {
    // Wait until Vite has replaced the plugin's exit handler before quitting.
    // Quitting normally preserves the application's native close guards.
    await new Promise<void>((resolve, reject) => {
      const finish = (error?: Error) => {
        clearTimeout(timer);
        process.removeListener("message", ready);
        process.removeListener("disconnect", disconnected);
        if (error) reject(error);
        else resolve();
      };
      const ready = (message: unknown) => {
        if (
          message &&
          typeof message === "object" &&
          "type" in message &&
          message.type === "hightex:restart-ready"
        )
          finish();
      };
      const disconnected = () =>
        finish(new Error("Development server disconnected before restart"));
      const timer = setTimeout(
        () =>
          finish(new Error("Development server did not acknowledge restart")),
        10000,
      );
      process.on("message", ready);
      process.once("disconnect", disconnected);
      process.send!({ type: "hightex:restart" }, (error: Error | null) => {
        if (error) finish(error);
      });
    });
    app.quit();
    return;
  }

  app.relaunch();
  app.quit();
}
