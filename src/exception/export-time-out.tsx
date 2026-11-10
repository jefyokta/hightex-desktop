import { OpenFileButton } from "@/components/ui/open-file-button";
import { ShouldNotified } from "./interfaces/should-notified";
import { t } from "@/utils/lang";

export class ExportTimeout extends ShouldNotified {
  constructor(desc: string, logFile: string) {
    super({
      message: t("common.export_timeout"),
      description: desc,
      action: <OpenFileButton title={t("common.open_log")} filePath={logFile} />,
    });
  }
}
