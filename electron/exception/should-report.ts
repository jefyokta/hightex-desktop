import { LoggerService } from "@main/service/logger-service";
import { Handled } from "./interface/handled";

export class ShouldReport extends Handled{
  protected file = "reported-error";
  protected context = "ex.context";
  constructor(msg: string, opt?: ErrorOptions) {
    super(msg, opt);
  }
  handle(): void {
    LoggerService.write(this, this.context, this.file);

  }
}
