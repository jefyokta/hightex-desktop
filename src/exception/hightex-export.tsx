import { ReactNode } from "react";
import { ShouldNotified } from "./interfaces/should-notified";

export class HighTexExportError extends ShouldNotified<"error"> {
  constructor(description: string, action?: ReactNode, id?: string) {
    super({
      message: "HighTex export failed",
      description,
      action,
      id,
    });
  }
}
