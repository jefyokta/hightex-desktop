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
        title: t("error.report.unexpected_error"),
        description,
      });
      toast.success(t("error.report.sent"));
    } catch (error) {
      toast.error(t("error.report.send_failed"), {
        description: truncate(ApplicationError.normilize(error), 100),
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
    sending ? t("error.report.sending") : t("error.report.button"),
  );
}

export class ShouldReport extends ShouldNotified {
  constructor(description: string, prevErr?: any) {
    super({
      message: t("error.report.unexpected_error"),
      description: description + "\n" + ApplicationError.normilize(prevErr),
      action: React.createElement(ReportIssueAction, { description }),
    });
  }
}