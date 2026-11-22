import { useState } from "react";
import { ChevronDown, FolderOpen, History, RefreshCw, Save, SaveAll } from "lucide-react";
import type { Editor } from "@tiptap/core";
import type { Chapter } from "@/editor/chapter";
import { useSaveDocument } from "@/hooks/use-save-document";
import { useAppLanguage } from "@/hooks/use-app-language";
import { isMac } from "@/utils/is-mac";
import { t } from "@/utils/lang";
import { ToolbarButton } from "./toolbar-button";
import { DocumentFileStatus, describeSaveState } from "./document-file-status";
import { RecoveryDialog } from "../local/recovery-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger,
} from "../ui/dropdown-menu";

export function DocumentSaveActions({ editor, chapter }: { editor: Editor | null; chapter: Chapter }) {
  useAppLanguage();
  const { save, reload, refresh, locate, reveal, state } = useSaveDocument(editor, chapter);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const presentation = describeSaveState(state);

  return (
    <>
      <div className="flex items-center">
        <ToolbarButton
          icon={presentation.icon}
          tour="editor-save"
          className="relative"
          title={`${t("editor.save.idle")} · ${presentation.label}`}
          aria-busy={state.saving}
          aria-keyshortcuts="Control+S Meta+S"
          disabled={state.saving}
          onClick={() => void save()}
        >
          {!state.saving && (
            <span aria-hidden="true" className={`absolute right-1 bottom-1 size-1 rounded-full ${presentation.indicator}`} />
          )}
        </ToolbarButton>
        <DropdownMenu onOpenChange={open => { if (open) void refresh(); }}>
          <DropdownMenuTrigger asChild>
            <ToolbarButton icon={ChevronDown} className="w-5" tour="editor-save-menu" spinnable={false}
              title={t("editor.save.options")} disabled={state.saving} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 p-1.5">
            <DocumentFileStatus state={state} presentation={presentation} />
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void save()}>
              <Save /> {t("editor.save.action")}
              <DropdownMenuShortcut>{isMac ? "⌘S" : "Ctrl+S"}</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void save("save-as")}>
              <SaveAll /> {t("editor.save.as")}
              <DropdownMenuShortcut>{isMac ? "⇧⌘S" : "Ctrl+Shift+S"}</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!state.path || state.missing} onSelect={() => void reveal()}>
              <FolderOpen /> {t("editor.save.reveal")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void locate()}>
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
