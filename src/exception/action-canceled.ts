import { ShouldNotified } from "./interfaces/should-notified";
import { t } from "@/utils/lang";

export class ActionCanceled extends ShouldNotified {
  constructor(action: string = "") {
    super({ message: t("error.action_canceled"), description: action });
  }
}
