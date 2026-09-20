import { Button } from "@/components/ui/button";
import { ShouldNotified } from "./interfaces/should-notified";
import { FrameManager } from "@/frame/manager";
import { t } from "@/utils/lang";

export class PageOverflow extends ShouldNotified<"warning"> {
  constructor(page: number) {
    super({
      message: t("error.page_overflow.title"),
      description: t("error.page_overflow.description", { page }),
      action: (
        <Button
          onClick={() => {
            const frame = document.querySelector("iframe");
            if (!frame) return;
            FrameManager.sendMessage(
              "page:requested",
              { pageId: `page-${page}` },
              frame,
            );
          }}
        >
          {t("error.page_overflow.see")}
        </Button>
      ),
      id: `page-${page}`,
    });
  }
}
