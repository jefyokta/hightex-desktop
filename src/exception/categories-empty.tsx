import { Button } from "@/components/ui/button";
import { ShouldNotified } from "./interfaces/should-notified";
import { t } from "@/utils/lang";

export class CategoryEmpty extends ShouldNotified<"error"> {
  level: "error" = "error";
  constructor() {
    super({
      message: t("error.category.missing"),
      description: t("error.category.missing.desc"),
      action: (
        <Button
          onClick={() => {
            location.href = "/";
          }}
        >
          {t("back")}
        </Button>
      ),
    });
  }
}
