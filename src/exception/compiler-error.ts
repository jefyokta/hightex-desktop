import { ShouldNotified } from "./interfaces/should-notified";
import { t } from "@/utils/lang";

export class CompilerError extends ShouldNotified {
  constructor(desc: string) {
    super({ message: t("error.compiler.error"), description: desc });
  }
}
