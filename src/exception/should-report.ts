import React, { useState } from "react";
import { toast } from "sonner";
// import { useAuthModal } from "@/context/auth-modal-context";
// import { useUser } from "@/hooks/use-user";
import { ApplicationError } from "./interfaces/application-error";
import { ShouldNotified } from "./interfaces/should-notified";
import { truncate } from "@/utils/truncate";

function ReportIssueAction({ description }: { description: string }) {
  // const { user } = useUser();
  // const { openLogin } = useAuthModal();
  const [sending, setSending] = useState(false);

  const report = async () => {
    try {
      setSending(true);
      await window.hightex.reportError({
        title: "Unexpected Error",
        description,
      });
      toast.success("Error report sent");
    } catch (error) {
      toast.error("Unable to report error", {
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
    sending ? "Reporting..." : "Report",
  );
}

export class ShouldReport extends ShouldNotified {
  constructor(description: string) {
    super({
      message: "Unexpected Error",
      description,
      action: React.createElement(ReportIssueAction, { description }),
    });
  }
}
