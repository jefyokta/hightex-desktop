import { ShouldSendToRenderer } from "./should-send-to-renderer";
import type { CloudErrorCode } from "../../sharable-types/cloud-error";

export class CloudError extends ShouldSendToRenderer {
  protected rendererErrorClass = "CloudError";

  constructor(
    readonly code: CloudErrorCode,
    options?: ErrorOptions,
  ) {
    super(code, options);
    this.message = `${this.rendererErrorClass}:${code}`;
  }
}
