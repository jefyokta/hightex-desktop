import React, { useState } from "react";
import { toast } from "sonner";
// import { useAuthModal } from "@/context/auth-modal-context";
// import { useUser } from "@/hooks/use-user";
import { ApplicationError } from "./interfaces/application-error";
import { ShouldNotified } from "./interfaces/should-notified";
import { truncate } from "@/utils/truncate";
import { t } from "@/utils/lang";

function ReportIssueAction({ description }: { description: string }) {
  // const { user } = useUser();
  // const { openLogin } = useAuthModal();
  const [sending, setSending] = useState(false);

  const report = async () => {
    try {
      setSending(true);
      await window.hightex.reportError({
        title: t("error.unexpected"),
        description,
      });
      toast.success(t("error.report_sent"));
    } catch (error) {
      toast.error(t("error.report_failed"), {
        description: truncate(ApplicationError.normilize(error), 100),
        action: {
          label: t("error.copy_error"),
          onClick: () => {
            const formatted = [
              `### Error Details`,
              `- **Title**: ${t("error.unexpected")}`,
              `- **Timestamp**: ${new Date().toISOString()}`,
              `- **Platform**: ${typeof navigator !== "undefined" ? navigator.userAgent : "Desktop"}`,
              ``,
              `\`\`\`text`,
              description,
              `\`\`\``,
            ].join("\n");
            navigator.clipboard?.writeText(formatted).catch(() => null);
            toast.success(t("error.copied_toast"));
            window.open(
              "https://github.com/jefyokta/hightex-desktop/issues/new",
              "_blank",
            );
          },
        },
      });
    } finally {
      setSending(false);
    }
  };

  return React.createElement(
    "button",
    {
      type: "button",
      disabled: sending,
      onClick: report,
      className:
        "text-sm font-medium border p-1 px-1.5 rounded-sm disabled:opacity-60",
    },
    sending ? t("error.reporting") : t("error.report"),
  );
}

export class ShouldReport extends ShouldNotified {
  constructor(description: string) {
    super({
      message: t("error.unexpected"),
      description,
      action: React.createElement(ReportIssueAction, { description }),
    });
  }
}


