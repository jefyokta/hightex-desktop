import { ShouldNotified } from "./interfaces/should-notified";
import { t } from "@/utils/lang";

export class ImageIsInFigure extends ShouldNotified {
  constructor() {
    super({
      message: t("error.image.in_figure_title"),
      description: t("error.image.in_figure_desc"),
    });
  }
}
