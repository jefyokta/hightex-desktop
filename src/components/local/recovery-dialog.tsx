import { useState } from "react";
import { ArrowUpRight, Download, History, Loader2, ShieldCheck, Trash2 } from "lucide-react";
import { useDocumentRecoveries } from "@/hooks/use-document-recoveries";
import { useAppLanguage } from "@/hooks/use-app-language";
import { Manager } from "@/editor/manager";
import { Exporter } from "@/utils/htx/exporter";
import { t } from "@/utils/lang";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { useDialogViewport } from "@/hooks/use-dialog-viewport";

export function RecoveryDialog({ open, onOpenChange, sourceDocumentId }: {
  open: boolean; onOpenChange(open: boolean): void; sourceDocumentId?: string;
}) {
  const language = useAppLanguage();
  const viewport = useDialogViewport();
  const { documents, error } = useDocumentRecoveries(sourceDocumentId, open);
  const [busy, setBusy] = useState<string>();
  const run = async (id: string, action: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(id);
    try { await action(); }
    catch (error) {
      toast.error(t("recovery.action_failed"), { description: error instanceof Error ? error.message : String(error) });
    } finally { setBusy(undefined); }
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
            <article key={document.id} className="rounded-xl border bg-background p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-medium break-words">{document.recovery!.sourceTitle}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{new Intl.DateTimeFormat(language, {
                    dateStyle: "medium", timeStyle: "short",
                  }).format(document.recovery!.createdAt)}</p>
                  <p title={document.recovery!.sourceFile} className="mt-2 line-clamp-2 text-xs break-all text-muted-foreground">
                    {document.recovery!.sourceFile || t("recovery.local_document")}
                  </p>
                </div>
                {busy === document.id && <Loader2 className="size-4 shrink-0 animate-spin" />}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button size="sm" disabled={!!busy} onClick={() => void run(document.id, async () => {
                  await window.editor.open(document.id);
                  onOpenChange(false);
                })}><ArrowUpRight />{t("recovery.open")}</Button>
                <Button size="sm" variant="outline" disabled={!!busy} onClick={() => void run(document.id, async () => {
                  if (await window.editor.has(document.id)) await window.editor.flush(document.id);
                  const result = await new Exporter(document.id).export({ showDialog: true });
                  if (!result.canceled) toast.success(t("recovery.exported"));
                })}><Download />{t("recovery.save_copy")}</Button>
                <Button size="icon-sm" variant="ghost" className="ml-auto text-muted-foreground hover:text-destructive" disabled={!!busy}
                  aria-label={t("recovery.delete")} onClick={() => void run(document.id, () => Manager.deleteDocument(document.id))}>
                  <Trash2 />
                </Button>
              </div>
            </article>
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
