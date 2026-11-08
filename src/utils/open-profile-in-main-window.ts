import { toast } from "sonner";
import { t } from "@/utils/lang";

export async function openProfileInMainWindow() {
  try {
    await window.editor.openProfile();
  } catch {
    toast.error(t("dashboard.action_failed"));
  }
}
