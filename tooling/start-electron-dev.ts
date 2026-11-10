import type { ChildProcess } from "node:child_process";
import type { ElectronOptions } from "vite-plugin-electron";

type Startup = Parameters<NonNullable<ElectronOptions["onstart"]>>[0];
type ElectronProcess = NodeJS.Process & { electronApp?: ChildProcess };
let launching = Promise.resolve();

/** Keep Vite in charge of workspace restarts as well as main-process rebuilds. */
export function startElectronDev(context: Pick<Startup, "startup">) {
  launching = launching.catch(() => {}).then(() => launchElectron(context));
  return launching;
}

/** The preload may be the last initial build; it must use the same launcher. */
export function reloadElectronDev(context: Startup) {
  if ((process as ElectronProcess).electronApp) context.reload();
  else return startElectronDev(context);
}

async function launchElectron({ startup }: Pick<Startup, "startup">) {
  await startup(undefined, { stdio: ["inherit", "inherit", "inherit", "ipc"] });
  const child = (process as ElectronProcess).electronApp;
  if (!child) throw Error("Electron development process did not start");

  let restarting = false;
  child.on("message", (message) => {
    if (
      !message ||
      typeof message !== "object" ||
      !("type" in message) ||
      message.type !== "hightex:restart"
    )
      return;

    if (!restarting) {
      restarting = true;
      // The plugin normally exits Vite when Electron exits. A workspace restart
      // must retain the renderer server and start a new managed Electron child.
      child.removeListener("exit", process.exit);
      child.once("exit", () => {
        void startElectronDev({ startup }).catch((error) => {
          console.error(
            "Unable to restart Electron development process",
            error,
          );
        });
      });
    }
    if (child.connected)
      child.send({ type: "hightex:restart-ready" }, (error) => {
        if (error)
          console.error("Unable to acknowledge Electron restart", error);
      });
  });
}
