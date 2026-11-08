import { getCliArgs, isCliInvocation } from "./cli-args";
import { initializeWorkspace } from "../workspaces/bootstrap";
import { app } from "electron";

async function main() {
  // Hold the lock at the shared installation root, before changing userData.
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }
  initializeWorkspace();
  // Deliberately dynamic: services must not open legacy/global stores first.
  const [{ Application }, { CLIApplication }] = await Promise.all([
    import("./application"),
    import("./cli-application"),
  ]);
  const cliArgs = getCliArgs();
  if (isCliInvocation(cliArgs)) new CLIApplication(cliArgs).bootstrap();
  else new Application().bootstrap();
}
void main().catch((error) => {
  console.error("Unable to initialize workspace", error);
  process.exitCode = 1;
});
