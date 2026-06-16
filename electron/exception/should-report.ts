import { LoggerService } from "@main/service/logger-service";

export class ShouldReport extends Error {
  protected file = "exerr";
  protected context = "ex.context";
  constructor(msg: string, opt?: ErrorOptions) {
    super(msg, opt);
    LoggerService.write(this, this.context, this.file);
  }
}
