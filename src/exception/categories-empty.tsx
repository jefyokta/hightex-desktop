import { Button } from "@/components/ui/button";
import { ShouldNotified } from "./interfaces/should-notified";
import { t } from "@/utils/lang";

export class CategoryEmpty extends ShouldNotified<"error"> {
  level = "error" as const;
  constructor(categoryId?: string) {
    super({
      message: t("error.category.missing"),
      description: categoryId
        ? t("error.category.unavailable", { id: categoryId })
        : t("error.category.missing.desc"),
      action: backAction(),
    });
  }
}

const backAction = () => (
  <Button
    onClick={() => {
      location.href = "/";
    }}
  >
    {t("back")}
  </Button>
);
