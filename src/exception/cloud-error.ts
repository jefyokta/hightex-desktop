import { RegisterMainError } from "@/decorators/error-name";
import { ShouldNotified } from "./interfaces/should-notified";
import { t } from "@/utils/lang";
import {
  CLOUD_ERROR_CODES,
  getCloudErrorCode,
  type CloudErrorCode,
  type KnownCloudErrorCode,
} from "../../sharable-types/cloud-error";

@RegisterMainError("CloudError")
export class CloudError extends ShouldNotified<"error"> {
  readonly level = "error" as const;
  readonly code: CloudErrorCode;

  constructor(code: string = "request_failed", options?: ErrorOptions) {
    const resolved = getCloudErrorCode(code) ?? "request_failed";
    const key = CLOUD_ERROR_CODES.includes(resolved as KnownCloudErrorCode)
      ? (resolved as KnownCloudErrorCode)
      : "request_failed";
    super({
      message: t("cloud.error_title"),
      description: t(`cloud.errors.${key}`),
    });
    this.code = resolved;
    this.cause = options?.cause;
  }

  onMainThrowing(_message: string): this {
    return this;
  }

  static from(error: unknown): CloudError {
    return error instanceof CloudError
      ? error
      : new CloudError(getCloudErrorCode(error) ?? "request_failed", {
          cause: error,
        });
  }
}
