import { useCallback, useEffect, useState } from "react";
import type { Editor } from "@tiptap/core";
import { GitBranch, GitCompare, GitMerge, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Chapter } from "@/editor/chapter";
import { Manager } from "@/editor/manager";
import { Storage } from "@/editor/storage";
import { HighTexDB } from "@/editor/storage/hightex-db";
import {
  createDocumentBranch,
  listDocumentBranches,
  mergeDocumentBranch,
} from "@/editor/storage/document-branches";
import { getEditorChapter } from "@/editor/event";
import { ShouldNotified } from "@/exception/interfaces/should-notified";
import { t } from "@/utils/lang";
import { BranchComparisonDialog } from "./branch-comparison-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function BranchManagerDialog({
  open,
  onOpenChange,
  editor,
  chapter,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  editor: Editor;
  chapter: Chapter;
}) {
  const [branches, setBranches] = useState<HighTexDocument[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [currentDocument, setCurrentDocument] = useState<HighTexDocument>();
  const [compareBranchId, setCompareBranchId] = useState<string>();

  const refresh = useCallback(async () => {
    try {
      const [list, current] = await Promise.all([
        listDocumentBranches(chapter.getDocumentId()),
        HighTexDB.getInstance().documents.get(chapter.getDocumentId()),
      ]);
      setBranches(list);
      setCurrentDocument(current);
    } catch (error) {
      console.error("Could not load document branches", error);
      toast.error(t("editor.branches.load_failed"));
    }
  }, [chapter]);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  const flushCurrent = async () => {
    if (editor.isDestroyed || getEditorChapter(editor) !== chapter) return;
    await Manager.emit("update", { editor });
    await Storage.instance.waitForDocument(chapter.getDocumentId());
  };

  const switchTo = async (document: HighTexDocument) => {
    if (document.id === chapter.getDocumentId()) return;
    setBusy(true);
    try {
      await flushCurrent();
      onOpenChange(false);
      await window.editor.open(document.id, document.file);
    } catch (error) {
      console.error("Could not switch document branch", error);
      toast.error(t("editor.branches.switch_failed"));
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    setBusy(true);
    try {
      await flushCurrent();
      const branch = await createDocumentBranch(chapter.getDocumentId(), name);
      setName("");
      onOpenChange(false);
      await window.editor.open(branch.id, branch.file);
      toast.success(t("editor.branches.created", { name: branch.branchName }));
    } catch (error) {
      console.error("Could not create document branch", error);
      if (error instanceof ShouldNotified)
        toast.warning(error.message, { description: error.description });
      else toast.error(t("editor.branches.create_failed"));
    } finally {
      setBusy(false);
    }
  };

  const merge = async (branch: HighTexDocument) => {
    if (
      !window.confirm(
        t("editor.branches.merge_confirm", {
          name: branch.branchName || branch.title,
        }),
      )
    )
      return;
    setBusy(true);
    try {
      if (branch.id === chapter.getDocumentId()) await flushCurrent();
      await mergeDocumentBranch(branch.id);
      await refresh();
      toast.success(
        t("editor.branches.merged", {
          name: branch.branchName || branch.title,
        }),
      );
    } catch (error) {
      console.error("Could not merge document branch", error);
      if (error instanceof ShouldNotified)
        toast.warning(error.message, { description: error.description });
      else toast.error(t("editor.branches.merge_failed"));
    } finally {
      setBusy(false);
    }
  };

  const compare = async (branch: HighTexDocument) => {
    setBusy(true);
    try {
      await flushCurrent();
      const mainId = branch.parentId;
      await Promise.all(
        [mainId, branch.id]
          .filter((id): id is string => !!id && id !== chapter.getDocumentId())
          .map((id) => window.editor.flush(id)),
      );
      setCompareBranchId(branch.id);
    } catch (error) {
      console.error("Could not prepare branch comparison", error);
      toast.error(t("editor.branches.compare_failed"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (branch: HighTexDocument) => {
    if (branch.id === chapter.getDocumentId()) return;
    if (
      !window.confirm(
        t("editor.branches.delete_confirm", {
          name: branch.branchName || branch.title,
        }),
      )
    )
      return;
    setBusy(true);
    try {
      await HighTexDB.getInstance().deleteDocument(branch.id);
      await refresh();
      toast.success(t("dashboard.deleted"));
    } catch (error) {
      console.error("Could not delete document branch", error);
      toast.error(t("dashboard.action_failed"));
    } finally {
      setBusy(false);
    }
  };

  const currentBranchId = chapter.getDocumentId();
  const currentBranchName = currentDocument?.parentId
    ? currentDocument.branchName || currentDocument.title
    : t("editor.branches.main");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle>{t("editor.branches.title")}</DialogTitle>
          <DialogDescription>
            {t("editor.branches.description")}
          </DialogDescription>
          <p className="pt-2 text-sm">
            {t("editor.branches.current_branch")}:{" "}
            <strong>{currentBranchName}</strong>
          </p>
        </DialogHeader>
        <div className="flex gap-2 border-b p-5">
          <Input
            maxLength={64}
            value={name}
            placeholder={t("editor.branches.name_placeholder")}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !busy && name.trim()) void create();
            }}
            disabled={busy}
          />
          <Button onClick={() => void create()} disabled={busy || !name.trim()}>
            {busy ? t("editor.branches.creating") : t("editor.branches.create")}
          </Button>
        </div>
        <div className="max-h-[52dvh] space-y-2 overflow-y-auto p-5">
          {branches.map((branch) => {
            const isCurrent = branch.id === currentBranchId;
            const isMain = !branch.parentId;
            const branchName = isMain
              ? t("editor.branches.main")
              : branch.branchName || branch.title;
            return (
              <div
                key={branch.id}
                className="flex items-center gap-3 rounded-xl border p-3"
              >
                <GitBranch className="size-4 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{branchName}</p>
                  {isCurrent && (
                    <p className="text-xs text-muted-foreground">
                      {t("editor.branches.current")}
                    </p>
                  )}
                </div>
                {!isCurrent && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => void switchTo(branch)}
                  >
                    {t("editor.branches.switch")}
                  </Button>
                )}
                {!isMain && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title={t("editor.branches.compare")}
                      aria-label={t("editor.branches.compare")}
                      disabled={busy}
                      onClick={() => void compare(branch)}
                    >
                      <GitCompare />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title={t("editor.branches.merge_to_main")}
                      aria-label={t("editor.branches.merge_to_main")}
                      disabled={busy}
                      onClick={() => void merge(branch)}
                    >
                      <GitMerge />
                    </Button>
                    {!isCurrent && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title={t("editor.branches.delete")}
                        aria-label={t("editor.branches.delete")}
                        disabled={busy}
                        onClick={() => void remove(branch)}
                      >
                        <Trash2 />
                      </Button>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
      <BranchComparisonDialog
        open={!!compareBranchId}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setCompareBranchId(undefined);
        }}
        branchId={compareBranchId}
      />
    </Dialog>
  );
}
