import { ShouldNotified } from "./interfaces/should-notified";
import { t } from "@/utils/lang";

export class ImageConvertError extends ShouldNotified {
  constructor(message: string) {
    super({ message: t("error.image.convert_error"), description: message });
  }
}
