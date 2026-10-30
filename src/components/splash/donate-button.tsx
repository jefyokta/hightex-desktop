import { ArrowUpRight, Coffee } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { t } from "@/utils/lang";

export function DonateButton() {
  const openDonation = async () => {
    try {
      const url = await window.hightex.serverUrl("/support-us");
      await window.file.openExternal(url);
    } catch {
      toast.error(t("splash.donate.open_failed"));
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-2 rounded-lg border-[#6b8f71]/30 text-[#6b8f71] hover:bg-[#6b8f71]/10 hover:text-[#6b8f71] dark:text-[#9bb59e] dark:hover:text-[#9bb59e]"
      onClick={() => void openDonation()}
      title={t("splash.donate.description")}
      aria-label={t("splash.donate.description")}
    >
      <Coffee className="size-3.5" aria-hidden="true" />
      {t("splash.donate.label")}
      <ArrowUpRight className="size-3" aria-hidden="true" />
    </Button>
  );
}
