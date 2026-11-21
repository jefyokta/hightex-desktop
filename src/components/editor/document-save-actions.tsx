import { useState } from "react";
import { AlertCircle, ChevronDown, FolderOpen, History, Loader2, RefreshCw, Save, SaveAll } from "lucide-react";
import type { Editor } from "@tiptap/core";
import type { Chapter } from "@/editor/chapter";
import { documentFiles } from "@/editor/document/file-source";
import { useSaveDocument } from "@/hooks/use-save-document";
import { useAppLanguage } from "@/hooks/use-app-language";
import { isMac } from "@/utils/is-mac";
import { t } from "@/utils/lang";
import { toast } from "sonner";
import { ToolbarButton } from "./toolbar-button";
import { RecoveryDialog } from "../local/recovery-dialog";
import { documentSaving } from "@/editor/document/saving";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger,
} from "../ui/dropdown-menu";

export function DocumentSaveActions({ editor, chapter }: { editor: Editor | null; chapter: Chapter }) {
  const language = useAppLanguage();
  const { save, reload, state } = useSaveDocument(editor, chapter);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const Icon = state.saving ? Loader2 : state.error || state.externalChanged ? AlertCircle : Save;
  const status = state.saving ? "saving" : state.error ? "error"
    : state.externalChanged ? "external_changed"
    : !state.path || state.missing ? "local" : state.modified ? "modified" : "file_saved";
  const label = t(`editor.save.${status}`);
  const fileName = state.path?.split(/[\\/]/).pop();
  const showInFolder = async () => {
    if (!state.path) return;
    try { await window.file.showInFolder(state.path); }
    catch (error) {
      toast.error(t("editor.save.reveal_failed"), { description: error instanceof Error ? error.message : String(error) });
    }
  };

  return (
    <>
      <div className="flex items-center">
        <ToolbarButton
          icon={Icon}
          tour="editor-save"
          className="relative"
          title={`${t("editor.save.idle")} · ${label}`}
          aria-busy={state.saving}
          aria-keyshortcuts="Control+S Meta+S"
          disabled={state.saving}
          onClick={() => void save()}
        >
          {!state.saving && <span aria-hidden="true" className={`absolute right-1 bottom-1 size-1 rounded-full ${
            status === "file_saved" ? "bg-emerald-600 dark:bg-emerald-400"
              : status === "local" ? "bg-sky-600 dark:bg-sky-400" : "bg-amber-600 dark:bg-amber-400"
          }`} />}
        </ToolbarButton>
        <DropdownMenu onOpenChange={open => { if (open) void documentSaving.reconcile(); }}>
          <DropdownMenuTrigger asChild>
            <ToolbarButton icon={ChevronDown} className="w-5" tour="editor-save-menu" spinnable={false}
              title={t("editor.save.options")} disabled={state.saving} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 p-1.5">
            <div data-document-file-status className="px-2.5 py-3">
              <div className="flex items-start gap-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted/40"><Save className="size-3.5 text-muted-foreground" /></span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium" title={fileName}>{fileName || t("editor.save.no_file")}</p>
                  <p role="status" className={`mt-1 text-[11px] ${status === "file_saved" ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}`}>{label}</p>
                </div>
              </div>
              {state.path && <p className="mt-2 line-clamp-2 text-[10px] leading-4 break-all text-muted-foreground" title={state.path}>{state.path}</p>}
              <p className="mt-2 text-[11px] leading-4 text-muted-foreground">{t(state.externalChanged
                ? "editor.save.external_hint" : state.missing ? "editor.save.missing_hint" : "editor.save.local_hint")}</p>
              {state.savedAt && !state.modified && <p className="mt-1 text-[10px] text-muted-foreground">{new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short" }).format(state.savedAt)}</p>}
              {state.error && <div role="alert" className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5">
                <p className="text-xs font-medium">{t(`editor.save.errors.${state.error.code}`)}</p>
                <p className="mt-1 max-h-24 overflow-y-auto text-[10px] leading-4 break-words text-muted-foreground">{state.error.detail}</p>
              </div>}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void save()}>
              <Save /> {t("editor.save.action")}
              <DropdownMenuShortcut>{isMac ? "⌘S" : "Ctrl+S"}</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void save("save-as")}>
              <SaveAll /> {t("editor.save.as")}
              <DropdownMenuShortcut>{isMac ? "⇧⌘S" : "Ctrl+Shift+S"}</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!state.path || state.missing} onSelect={() => void showInFolder()}>
              <FolderOpen /> {t("editor.save.reveal")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void documentFiles.locate(chapter.document.id)}>
              <FolderOpen /> {t("open_file.locate_source")}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!state.path || state.missing} onSelect={() => void reload()}>
              <RefreshCw /> {t("editor.save.reload")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setRecoveryOpen(true)}>
              <History /> {t("recovery.title")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <RecoveryDialog open={recoveryOpen} onOpenChange={setRecoveryOpen} sourceDocumentId={chapter.document.id} />
    </>
  );
}
