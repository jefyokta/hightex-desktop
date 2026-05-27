import { Button } from "@/components/ui/button";
import { ShouldNotified } from "./interfaces/should-notified";
import { FrameManager } from "@/frame/manager";

export class PageOverflow extends ShouldNotified<"warning"> {
  constructor(page: number) {
    super({
      message: "Page overflow!",
      description: `Found overflow on page ${page}`,
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
          See
        </Button>
      ),
      id: `page-${page}`,
    });
  }
}
