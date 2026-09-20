import { ReactNode } from "react";
import { ShouldNotified } from "./interfaces/should-notified";
import { t } from "@/utils/lang";

export class HighTexImportError extends ShouldNotified<"error"> {
  constructor(description: string, action?: ReactNode, id?: string) {
    super({
      message: t("error.htx.import_failed"),
      description,
      action,
      id,
    });
  }
}
