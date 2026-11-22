import { ArrowUpRight, Download, Loader2, Trash2 } from "lucide-react";
import type { RecoveryDocument } from "@/editor/document/files/contracts";
import { t } from "@/utils/lang";
import { Button } from "../ui/button";

interface Props {
  document: RecoveryDocument;
  formatDate: Intl.DateTimeFormat;
  busy: boolean;
  disabled: boolean;
  onOpen(): void;
  onSaveCopy(): void;
  onDelete(): void;
}

export function RecoveryEntry({ document, formatDate, busy, disabled, onOpen, onSaveCopy, onDelete }: Props) {
  const { recovery } = document;

  return (
    <article className="rounded-xl border bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-medium break-words">{recovery.sourceTitle}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{formatDate.format(recovery.createdAt)}</p>
          <p title={recovery.sourceFile} className="mt-2 line-clamp-2 text-xs break-all text-muted-foreground">
            {recovery.sourceFile || t("recovery.local_document")}
          </p>
        </div>
        {busy && <Loader2 className="size-4 shrink-0 animate-spin" />}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={disabled} onClick={onOpen}>
          <ArrowUpRight />{t("recovery.open")}
        </Button>
        <Button size="sm" variant="outline" disabled={disabled} onClick={onSaveCopy}>
          <Download />{t("recovery.save_copy")}
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          className="ml-auto text-muted-foreground hover:text-destructive"
          disabled={disabled}
          aria-label={t("recovery.delete")}
          onClick={onDelete}
        >
          <Trash2 />
        </Button>
      </div>
    </article>
  );
}
