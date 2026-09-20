import { Button } from "@/components/ui/button";
import { ShouldNotified } from "./interfaces/should-notified";
import { HighTexDB } from "@/editor/storage/hightex-db";
import { t } from "@/utils/lang";

export class DocumentBroken extends ShouldNotified<"error"> {
  level: "error" = "error";
  constructor(documentId: string) {
    super({
      message: t("error.document.crashed"),
      description: t("error.document.invalid_content"),
      action: (
        <div className="flex justify-center space-x-1">
          <Button
            onClick={() => {
              location.href = "/";
            }}
          >
            {t("back")}
          </Button>
          <Button
            variant={"destructive"}
            onClick={async () => {
              await HighTexDB.getInstance().documents.delete(documentId);
              location.href = "/";
            }}
          >
            {t("error.document.delete_button")}
          </Button>
        </div>
      ),
    });
  }
}
