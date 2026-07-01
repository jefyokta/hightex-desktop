import { app } from "electron";

export const CLI_COMMANDS = new Set([
  "compile",
  "document",
  "documents",
  "docs",
  "version",
  "-v",
  "--version",
]);

const IGNORED_ARGS = new Set(["--no-sandbox", "--no-sanbox"]);

export function getCliArgs(argv = process.argv) {
  return argv
    .slice(app.isPackaged ? 1 : 2)
    .filter((arg) => !IGNORED_ARGS.has(arg));
}

export function isCliInvocation(args: string[]) {
  return CLI_COMMANDS.has(args[0] ?? "");
}
