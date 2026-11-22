import { History, ShieldCheck } from "lucide-react";
import { useDocumentRecoveries } from "@/hooks/use-document-recoveries";
import { useAppLanguage } from "@/hooks/use-app-language";
import { t } from "@/utils/lang";
import { Button } from "../ui/button";
import { RecoveryEntry } from "./recovery-entry";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { useDialogViewport } from "@/hooks/use-dialog-viewport";

export function RecoveryDialog({ open, onOpenChange, sourceDocumentId }: {
  open: boolean; onOpenChange(open: boolean): void; sourceDocumentId?: string;
}) {
  const language = useAppLanguage();
  const viewport = useDialogViewport();
  const recoveries = useDocumentRecoveries(sourceDocumentId, open);
  const { documents, error, busy } = recoveries;
  const formatDate = new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short" });

  const openRecovery = async (id: string) => {
    if (await recoveries.open(id)) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-document-recoveries style={viewport} className="flex max-h-[85dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b bg-muted/30 p-6">
          <span className="mb-3 flex size-10 items-center justify-center rounded-xl border bg-background text-emerald-700 dark:text-emerald-400">
            <ShieldCheck className="size-5" />
          </span>
          <DialogTitle>{t("recovery.title")}</DialogTitle>
          <DialogDescription>{t("recovery.description")}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 space-y-3 overflow-y-auto p-4 sm:p-6">
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : !documents.length ? (
            <div className="py-10 text-center">
              <History className="mx-auto mb-3 size-7 text-muted-foreground" />
              <p className="font-medium">{t("recovery.empty")}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t("recovery.empty_description")}</p>
            </div>
          ) : documents.map(document => (
            <RecoveryEntry
              key={document.id}
              document={document}
              formatDate={formatDate}
              busy={busy === document.id}
              disabled={!!busy}
              onOpen={() => void openRecovery(document.id)}
              onSaveCopy={() => void recoveries.saveCopy(document.id)}
              onDelete={() => void recoveries.remove(document.id)}
            />
          ))}
        </div>
        <div className="flex shrink-0 items-center justify-between gap-3 border-t bg-muted/20 px-6 py-4">
          <p className="text-xs text-muted-foreground">{t("recovery.footer")}</p>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>{t("common.close")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
