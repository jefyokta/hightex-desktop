import { useIPC } from "@/hooks/use-ipc";
import { toast } from "sonner";
import { t } from "@/utils/lang";

export async function openProfileInMainWindow() {
  try {
    await useIPC("editor").editor.openProfile();
  } catch {
    toast.error(t("dashboard.action_failed"));
  }
}
