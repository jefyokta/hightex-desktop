import { ShouldReport } from "./should-report";

export class NetworkException extends ShouldReport {
  protected file: string = "network-error.log";
  protected context: string = "network.service";
}
