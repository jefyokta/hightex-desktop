import { ReactNode } from "react";
import { ShouldNotified } from "./interfaces/should-notified";
import { t } from "@/utils/lang";

export class HighTexExportError extends ShouldNotified<"error"> {
  constructor(description: string, action?: ReactNode, id?: string) {
    super({
      message: t("error.htx.export_failed"),
      description,
      action,
      id,
    });
  }
}
