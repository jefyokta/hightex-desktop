import {
  ArrowLeftIcon,
  CircleHelp,
  Bold,
  DownloadCloudIcon,
  Heading2,
  Heading3,
  Heading4,
  Image,
  Italic,
  List,
  ListOrdered,
  Quote,
  Redo2,
  // ScanText,
  Sigma,
  Strikethrough,
  Table,
  Underline,
  Undo2,
  Search,
  Loader2,
  Settings,
  Save,
  Check,
  AlertCircle,
  GitBranch,
  // MessageCircle,
} from "lucide-react";

import React, {
  PropsWithChildren,
  //  useEffect,
  useState,
} from "react";
import { useCurrentEditor } from "../../hooks/use-editor";
import { useExpandableSidebar } from "@/hooks/use-expandable-sidebar";
import { t } from "@/utils/lang";
import { getEditorChapter } from "@/editor/event";
import { toast } from "sonner";
import { createFigureTable } from "@/editor/utils/create-figure-table";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { useEditorState } from "@tiptap/react";
import { createTable } from "@tiptap/extension-table";
import { createMathBlock } from "@/editor/utils/create-math-block";
import { useChapterStore } from "@/hooks/use-chapter";
import { SettingModal } from "./settings-modal";
import { useSaveDocument } from "@/hooks/use-save-document";
import { ChapterNavigation } from "./chapter-navigation";
import { BranchManagerDialog } from "./branch-manager-dialog";
// import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
// import { cn } from "@/lib/utils";
// import { CommentStorage } from "@/editor/storage/comment";
// import { getSnapshotLabel } from "@/utils/snapshot";
// import { formatDate } from "@/utils/date";

export const NavBar: React.FC = () => {
  const { editor } = useCurrentEditor();
  const navigation = (
    window as Window & {
      navigation?: { canGoBack: boolean; back: () => void };
    }
  ).navigation;
  const { chapter } = useChapterStore();
  const activeDocument = chapter?.document.ready
    ? chapter.document.getDocument()
    : undefined;
  const activeBranchName = activeDocument?.parentId
    ? activeDocument.branchName || activeDocument.title
    : undefined;
  const { save, status: saveStatus } = useSaveDocument(editor, chapter);
  const { setOpen, setContent } = useExpandableSidebar();
  const [exportingPdf, setExportingPdf] = React.useState(false);
  const [pdfProgress, setPdfProgress] = React.useState<number>(0);
  const [pdfStatus, setPdfStatus] = React.useState<string>("");
  const [openSetting, setOpenSetting] = useState(false);
  const [openBranchDialog, setOpenBranchDialog] = useState(false);
  const state = useEditorState({
    editor,
    selector: (ctx) => ({
      isBold: ctx.editor?.isActive("bold") ?? false,
      isItalic: ctx.editor?.isActive("italic") ?? false,
      isUnderline: ctx.editor?.isActive("underline") ?? false,
      isStrike: ctx.editor?.isActive("strike") ?? false,
      isBulletList: ctx.editor?.isActive("bulletList") ?? false,
      isOrderedList: ctx.editor?.isActive("orderedList") ?? false,
      isH2: ctx.editor?.isActive("heading", { level: 2 }) ?? false,
      isH3: ctx.editor?.isActive("heading", { level: 3 }) ?? false,
      isH4: ctx.editor?.isActive("heading", { level: 4 }) ?? false,
      isTable: ctx.editor?.isActive("figureTable") ?? false,
      isGrid: ctx.editor?.isActive("grid") ?? false,
      isImage: ctx.editor?.isActive("imageFigure"),
      isMath: ctx.editor?.isActive("blockMath") ?? false,
    }),
  });

  // const [snapshots, setSnapshots] = useState<SnapshotEntity[]>([]);
  // const [snap, setSnap] = useState<string | null>(null)

  // useEffect(() => {
  //   if (!chapter) return
  //   window.hightex.snapshot.document(chapter.document.id).then(setSnapshots)

  // }, [chapter])

  // useEffect(() => {
  //   if (!snap) {
  //     CommentStorage.instance.recreate()
  //     editor?.commands.updateDecorations("comment")

  //     return;
  //   }
  //   CommentStorage.create(snap).then(() => {
  //     editor?.commands.updateDecorations("comment")

  //   })
  // }, [snap])

  if (!editor || chapter?.frozen) {
    return (
      <div className="sticky top-0 z-50 mx-auto flex w-fit items-center rounded-xl bg-white/80 p-1 backdrop-blur dark:bg-neutral-900/70">
        <ChapterNavigation />
        <Button
          title={t("guide.replay")}
          icon={CircleHelp}
          onClick={() =>
            window.dispatchEvent(new Event("hightex:editor-guide"))
          }
        />
      </div>
    );
  }

  return (
    <>
      <div
        className="
      sticky top-0 z-50 max-w-max mx-auto
      bg-white/80 dark:bg-neutral-900/70
      backdrop-blur
      border-b border-neutral-200 dark:border-neutral-800
      rounded-xl
    "
      >
        <div className="flex justify-center">
          <div className="flex items-center gap-2 px-3 py-2 overflow-x-auto whitespace-nowrap max-w-full">
            <ButtonGroup>
              <Button
                icon={ArrowLeftIcon}
                title="Back"
                disabled={!navigation?.canGoBack}
                spinnable={false}
                onClick={() => {
                  navigation?.back();
                }}
              />
              <ChapterNavigation />
            </ButtonGroup>

            <div
              data-tour="editor-formatting"
              className="flex items-center gap-1"
            >
              <ButtonGroup>
                <button
                  type="button"
                  title={
                    activeBranchName
                      ? t("editor.branches.active", { name: activeBranchName })
                      : t("editor.branches.title")
                  }
                  aria-label={
                    activeBranchName
                      ? t("editor.branches.active", { name: activeBranchName })
                      : t("editor.branches.title")
                  }
                  className="flex h-8 max-w-40 items-center gap-1.5 rounded-md px-2 text-xs text-neutral-700 transition hover:bg-neutral-200 dark:text-neutral-200 dark:hover:bg-neutral-700"
                  onClick={() => setOpenBranchDialog(true)}
                >
                  <GitBranch className="size-3.5 shrink-0" />
                  {activeBranchName && (
                    <span className="truncate">{activeBranchName}</span>
                  )}
                </button>
                <Button
                  title="undo"
                  icon={Undo2}
                  onClick={() => editor.chain().focus().undo().run()}
                />
                <Button
                  title="redo"
                  icon={Redo2}
                  onClick={() => editor.chain().focus().redo().run()}
                />
              </ButtonGroup>

              <ButtonGroup>
                <Button
                  tour="editor-headings"
                  title="h2"
                  icon={Heading2}
                  active={state?.isH2}
                  onClick={() =>
                    editor.chain().focus().setHeading({ level: 2 }).run()
                  }
                />
                <Button
                  title="h3"
                  icon={Heading3}
                  active={state?.isH3}
                  onClick={() =>
                    editor.chain().focus().setHeading({ level: 3 }).run()
                  }
                />
                <Button
                  title="h4"
                  icon={Heading4}
                  active={state?.isH4}
                  onClick={() =>
                    editor.chain().focus().setHeading({ level: 4 }).run()
                  }
                />
              </ButtonGroup>

              <ButtonGroup>
                <Button
                  icon={Bold}
                  tour="editor-bold"
                  title="bold"
                  active={state?.isBold}
                  onClick={() => editor.chain().focus().toggleBold().run()}
                />
                <Button
                  icon={Italic}
                  tour="editor-italic"
                  title="italic"
                  active={state?.isItalic}
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                />
                <Button
                  icon={Underline}
                  title="underline"
                  active={state?.isUnderline}
                  onClick={() => editor.chain().focus().toggleUnderline().run()}
                />
                <Button
                  icon={Strikethrough}
                  title="strike"
                  active={state?.isStrike}
                  onClick={() => editor.chain().focus().toggleStrike().run()}
                />
              </ButtonGroup>

              <ButtonGroup>
                <Button
                  icon={List}
                  tour="editor-lists"
                  title="bullet list"
                  active={state?.isBulletList}
                  onClick={() =>
                    editor.chain().focus().toggleBulletList().run()
                  }
                />
                <Button
                  icon={ListOrdered}
                  title="ordered list"
                  active={state?.isOrderedList}
                  onClick={() =>
                    editor.chain().focus().toggleOrderedList().run()
                  }
                />
              </ButtonGroup>

              <ButtonGroup>
                <Button
                  tour="editor-math"
                  title="math"
                  icon={Sigma}
                  active={state?.isGrid}
                  onClick={() =>
                    editor
                      .chain()
                      ?.focus()
                      .insertContent(createMathBlock())
                      .run()
                  }
                />
                <Button
                  tour="editor-grid"
                  title="grid"
                  icon={Table}
                  active={state?.isGrid}
                  onClick={() =>
                    editor
                      .chain()
                      ?.focus()
                      .insertContent(createTable(editor.schema, 3, 3, false))
                      .run()
                  }
                />
                <Button
                  tour="editor-table"
                  title="table"
                  icon={Table}
                  active={state?.isTable}
                  onClick={() =>
                    editor
                      .chain()
                      ?.focus()
                      .insertContent(createFigureTable())
                      .run()
                  }
                />
                <Button
                  tour="editor-image"
                  title="image"
                  icon={Image}
                  active={state?.isImage}
                  onClick={() => editor.chain().focus().addFigureImage("")}
                />
              </ButtonGroup>

              <ButtonGroup>
                <Button
                  tour="editor-citation"
                  title="citation"
                  icon={Quote}
                  onClick={() => {
                    setContent("citation");
                    setOpen(true);
                  }}
                />
                <Button
                  icon={Search}
                  tour="editor-search"
                  title="search & replace"
                  onClick={() => {
                    window.dispatchEvent(
                      new KeyboardEvent("keydown", {
                        key: "f",
                        ctrlKey: true,
                        bubbles: true,
                      }),
                    );
                  }}
                />
                <Button
                  tour="editor-pdf"
                  title={
                    exportingPdf
                      ? `${pdfStatus || "Mengekspor PDF"} (${pdfProgress}%)`
                      : "download pdf"
                  }
                  icon={exportingPdf ? Loader2 : DownloadCloudIcon}
                  disabled={exportingPdf}
                  onClick={async () => {
                    if (exportingPdf) return;
                    setExportingPdf(true);
                    setPdfProgress(5);
                    setPdfStatus(t("common.preparing_pdf"));
                    const requestId = crypto.randomUUID();

                    const docId = getEditorChapter(editor)?.getDocumentId();
                    if (!docId) {
                      toast.error(t("error.document.not_found"));
                      setExportingPdf(false);
                      return;
                    }

                    const renderProgressToast = (
                      status: string,
                      progress: number,
                    ) => (
                      <div className="flex flex-col gap-1.5 w-full min-w-60">
                        <div className="flex justify-between items-center text-xs font-semibold">
                          <span className="truncate pr-2">{status}</span>
                          <span className="text-neutral-500 font-mono">
                            {progress}%
                          </span>
                        </div>
                        <div className="w-full bg-neutral-200 dark:bg-neutral-700 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-black dark:bg-white h-full transition-all duration-300 rounded-full"
                            style={{ width: `${Math.max(progress, 5)}%` }}
                          />
                        </div>
                      </div>
                    );

                    const toastId = toast.loading(
                      renderProgressToast("Menyiapkan ekspor PDF...", 5),
                    );

                    const unsubscribe = window.hightex.onPdfProgress(
                      (update) => {
                        if (update.requestId !== requestId) return;
                        const prog = update.progress ?? 0;
                        setPdfProgress(prog);
                        setPdfStatus(update.status);

                        toast.loading(
                          renderProgressToast(update.status, prog),
                          {
                            id: toastId,
                          },
                        );
                      },
                    );

                    try {
                      const result = await window.ipcRenderer.invoke(
                        "hightex:pdf",
                        docId,
                        false,
                        requestId,
                      );

                      if (result === null) {
                        toast.dismiss(toastId);
                        toast.info("Ekspor PDF dibatalkan", { duration: 3000 });
                        return;
                      }

                      toast.success(
                        <div className="flex flex-col gap-1">
                          <span className="font-semibold text-sm">
                            PDF Berhasil Disimpan!
                          </span>
                          <span className="text-xs text-neutral-500 truncate max-w-60">
                            {result.filename}
                          </span>
                        </div>,
                        {
                          id: toastId,
                          duration: 15000,
                          action: {
                            label: "Buka File",
                            onClick: () => window.file?.openPath?.(result.path),
                          },
                          cancel: {
                            label: "Buka Folder",
                            onClick: () =>
                              window.file?.showInFolder?.(result.path),
                          },
                        },
                      );
                    } catch (error) {
                      const msg =
                        error instanceof Error
                          ? error.message
                          : "Error while exporting PDF";
                      toast.error(t("common.export_failed"), {
                        description: msg,
                        id: toastId,
                        duration: 8000,
                      });
                    } finally {
                      unsubscribe();
                      setExportingPdf(false);
                      setPdfProgress(0);
                      setPdfStatus("");
                    }
                  }}
                />
              </ButtonGroup>
              <ButtonGroup>
                <Button
                  title={t("guide.replay")}
                  icon={CircleHelp}
                  onClick={() =>
                    window.dispatchEvent(new Event("hightex:editor-guide"))
                  }
                />
                <Button
                  tour="editor-save"
                  title={t(`editor.save.${saveStatus}`)}
                  icon={
                    saveStatus === "saving"
                      ? Loader2
                      : saveStatus === "saved"
                        ? Check
                        : saveStatus === "error"
                          ? AlertCircle
                          : Save
                  }
                  disabled={saveStatus === "saving"}
                  busy={saveStatus === "saving"}
                  shortcut="Control+S Meta+S"
                  onClick={() => void save()}
                />

                <Button
                  title="settings"
                  icon={Settings}
                  onClick={() => {
                    setOpenSetting(true);
                  }}
                ></Button>
              </ButtonGroup>
            </div>
          </div>
        </div>
      </div>
      <SettingModal open={openSetting} onClose={() => setOpenSetting(false)} />
      {chapter && editor && (
        <BranchManagerDialog
          open={openBranchDialog}
          onOpenChange={setOpenBranchDialog}
          editor={editor}
          chapter={chapter}
        />
      )}
    </>
  );
};

const ButtonGroup: React.FC<PropsWithChildren & { className?: string }> = ({
  children,
  className,
}) => {
  return (
    <div
      className={`
        flex items-center gap-0
        bg-neutral-100 dark:bg-neutral-800
        rounded-lg
        overflow-hidden
        ${className ?? ""}
      `}
    >
      {children}
    </div>
  );
};

type ButtonProps = {
  onClick?: () => void;
  icon: React.FC<{ className?: string }>;
  title?: string;
  tour?: string;
  disabled?: boolean;
  handleHover?: boolean;
  active?: boolean;
  spinnable?: boolean;
  busy?: boolean;
  shortcut?: string;
};

const Button: React.FC<ButtonProps & PropsWithChildren> = ({
  onClick,
  icon: Icon,
  title,
  tour,
  disabled,
  children,
  handleHover = true,
  active = false,
  spinnable = true,
  busy,
  shortcut,
}) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          data-tour={tour}
          title={title}
          aria-label={title}
          aria-busy={busy}
          aria-keyshortcuts={shortcut}
          disabled={disabled}
          className={`
        flex items-center justify-center
        w-8 h-8 p-1 rounded-md
        transition
        disabled:opacity-40 disabled:cursor-not-allowed
        
        text-neutral-700 dark:text-neutral-200
        ${
          active
            ? "bg-neutral-900/10 dark:bg-white/15 text-neutral-900 dark:text-white"
            : ""
        }
        ${handleHover ? "hover:bg-neutral-200 dark:hover:bg-neutral-700" : ""}
      `}
        >
          <Icon
            className={`w-3 h-3 ${disabled && spinnable ? "animate-spin" : ""}`}
          />
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{title}</TooltipContent>
    </Tooltip>
  );
};
