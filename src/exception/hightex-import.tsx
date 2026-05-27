import { ReactNode } from "react";
import { ShouldNotified } from "./interfaces/should-notified";

export class HighTexImportError extends ShouldNotified<"error"> {
  constructor(description: string, action?: ReactNode, id?: string) {
    super({
      message: "HighTex import failed",
      description,
      action,
      id,
    });
  }
}
