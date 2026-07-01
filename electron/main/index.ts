import { Application } from "./application";
import { CLIApplication } from "./cli-application";
import { getCliArgs, isCliInvocation } from "./cli-args";

const cliArgs = getCliArgs();

if (isCliInvocation(cliArgs)) {
  new CLIApplication(cliArgs).bootstrap();
} else {
  new Application().bootstrap();
}
