import { Button } from "@/components/ui/button";
import { ShouldNotified } from "./interfaces/should-notified";
import { HighTexDB } from "@/editor/storage/hightex-db";

export class DocumentBroken extends ShouldNotified<"error"> {
  level: "error" = "error";
  constructor(documentId: string) {
    super({
      message: "Document crashed!",
      description: "Document contains some invalid",
      action: (
        <div className="flex justify-center space-x-1">
          <Button
            onClick={() => {
              location.href = "/";
            }}
          >
            Back
          </Button>
          <Button
            variant={"destructive"}
            onClick={async () => {
              await HighTexDB.getInstance().documents.delete(documentId);
              location.href = "/";
            }}
          >
            Delete
          </Button>
        </div>
      ),
    });
  }
}
