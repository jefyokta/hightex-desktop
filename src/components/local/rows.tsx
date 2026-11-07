import {
  ArrowUpRight,
  Download,
  FileText,
  GitBranch,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { t, useAppLanguage } from "@/utils/lang";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ParsedItalic } from "@/utils/parse-italic";

export const Row = ({
  doc,
  branches,
  categories,
  selectMode,
  selected,
  disabled,
  onSelect,
  onEdit,
  onDelete,
  onExport,
}: {
  doc: HighTexDocument;
  branches: HighTexDocument[];
  categories: Category[];
  selectMode: boolean;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: (id: string) => Promise<void>;
  onExport: (id: string) => Promise<boolean>;
}) => {
  const language = useAppLanguage();
  const [busy, setBusy] = useState(false);
  const [branchesOpen, setBranchesOpen] = useState(false);
  const pending = useRef(false);
  const run = async (action: () => Promise<unknown>) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      await action();
    } catch {
      toast.error(t("dashboard.action_failed"));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const category = categories.find(
    (item) => String(item.id) === String(doc.category),
  );
  const date = doc.updatedAt ? new Date(doc.updatedAt) : undefined;
  const updatedAt =
    date && Number.isFinite(date.getTime())
      ? new Intl.DateTimeFormat(language === "id" ? "id-ID" : "en-US", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }).format(date)
      : t("workspace.no_activity");

  const pdf = async (watermark = false) => {
    const requestId = crypto.randomUUID();
    const toastId = toast.loading(t("common.preparing_pdf"));
    const off = window.hightex.onPdfProgress((update) => {
      if (update.requestId !== requestId) return;
      toast.loading(update.status, {
        id: toastId,
        description: `${Math.max(0, Math.min(100, update.progress ?? 0))}%`,
      });
    });
    try {
      const result = await window.ipcRenderer.invoke(
        "hightex:pdf",
        doc.id,
        watermark,
        requestId,
      );
      if (!result) {
        toast.dismiss(toastId);
        return;
      }
      toast.success(t("dashboard.pdf_saved"), {
        id: toastId,
        description: result.filename,
        duration: 10000,
        action: {
          label: t("dashboard.open_file"),
          onClick: () => window.file?.openPath?.(result.path),
        },
        cancel: {
          label: t("dashboard.open_folder"),
          onClick: () => window.file?.showInFolder?.(result.path),
        },
      });
    } catch {
      toast.error(t("common.export_failed"), { id: toastId });
    } finally {
      off();
    }
  };

  return (
    <>
      <article
        data-document-id={doc.id}
        data-selected={selectMode && selected}
        className="workspace-document group flex items-center gap-3 border-b border-border/60 px-4 py-4 transition-colors last:border-b-0 hover:bg-muted/35 sm:gap-4 sm:px-5"
      >
        {selectMode ? (
          <Checkbox
            checked={selected}
            disabled={disabled}
            onCheckedChange={onSelect}
            aria-label={t("dashboard.select_document", { title: doc.title })}
          />
        ) : (
          <span className="workspace-brand-icon flex size-10 shrink-0 items-center justify-center rounded-xl">
            <FileText className="size-5" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() =>
              selectMode
                ? onSelect()
                : void run(() => window.editor.open(doc.id, doc.file))
            }
            data-tour="document-open"
            title={doc.title}
            className="workspace-document-title line-clamp-2 text-left text-sm font-medium leading-relaxed transition-colors outline-none focus-visible:underline disabled:opacity-60"
          >
            <ParsedItalic text={doc.title || t("common.untitled_document")} />
          </button>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px]">
              {category?.name ?? t("dashboard.unavailable_category")}
            </span>
            <span className="text-border" aria-hidden="true">
              ·
            </span>
            <span>
              {date ? t("dashboard.updated", { date: updatedAt }) : updatedAt}
            </span>
          </div>
          {!selectMode && branches.length > 0 && (
            <div className="mt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy || disabled}
                aria-haspopup="dialog"
                aria-label={t("dashboard.versions_count", {
                  count: branches.length,
                })}
                className="h-7 gap-1.5 px-2 text-xs text-muted-foreground"
                onClick={() => setBranchesOpen(true)}
              >
                <GitBranch className="size-3.5" />
                {t("dashboard.versions_count", { count: branches.length })}
              </Button>
            </div>
          )}
        </div>
        {!selectMode && (
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={busy || disabled}
              aria-label={t("dashboard.open_document", { title: doc.title })}
              title={t("dashboard.open")}
              onClick={() =>
                void run(() => window.editor.open(doc.id, doc.file))
              }
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ArrowUpRight className="size-4 text-muted-foreground" />
              )}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={busy || disabled}
                  data-tour="document-actions"
                  aria-label={t("dashboard.document_actions", {
                    title: doc.title,
                  })}
                >
                  <MoreHorizontal className="size-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onSelect={onEdit}>
                  <Pencil />
                  {t("dashboard.edit_document")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => void run(() => onExport(doc.id))}
                >
                  <Download />
                  {t("dashboard.export_hightex")}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void run(() => pdf())}>
                  <FileText />
                  {t("dashboard.export_pdf")}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void run(() => pdf(true))}>
                  <FileText />
                  {t("dashboard.export_watermark")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => void run(() => onDelete(doc.id))}
                >
                  <Trash2 />
                  {t("dashboard.delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </article>
      <Dialog open={branchesOpen} onOpenChange={setBranchesOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("dashboard.versions_dialog_title", { title: doc.title })}
            </DialogTitle>
            <DialogDescription>
              {t("dashboard.versions_dialog_description")}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[55dvh] space-y-2 overflow-y-auto">
            {branches.map((branch) => (
              <div
                key={branch.id}
                className="flex items-center gap-3 rounded-xl border p-3"
              >
                <GitBranch className="size-4 shrink-0 text-muted-foreground" />
                <p className="min-w-0 flex-1 truncate font-medium">
                  {branch.branchName || branch.title}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy || disabled}
                  onClick={() => {
                    setBranchesOpen(false);
                    void run(() => window.editor.open(branch.id, branch.file));
                  }}
                >
                  {t("dashboard.open")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={busy || disabled}
                  aria-label={t("dashboard.delete_branch", {
                    name: branch.branchName || branch.title,
                  })}
                  onClick={() => void run(() => onDelete(branch.id))}
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
