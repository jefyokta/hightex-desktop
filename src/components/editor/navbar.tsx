import {
  ArrowLeftIcon,
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
  ScanText,
  Sigma,
  Strikethrough,
  Table,
  Underline,
  Undo2,
  Search,
  Loader2,
} from "lucide-react";

import React, { PropsWithChildren } from "react";
import { useNavigate } from "react-router-dom";
import { useCurrentEditor } from "../../hooks/use-editor";
import { useExpandableSidebar } from "@/hooks/use-expandable-sidebar";
import { Document } from "@/editor/document";
import { t } from "@/utils/lang";
import { Chapter } from "@/editor/chapter";
import { toast } from "sonner";
import { createFigureTable } from "@/editor/utils/create-figure-table";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { useEditorState } from "@tiptap/react";
import { createTable } from "@tiptap/extension-table";
import { createMathBlock } from "@/editor/utils/create-math-block";
import { useChapterStore } from "@/hooks/use-chapter";

export const NavBar: React.FC = () => {
  const { editor } = useCurrentEditor();
  const {chapter} = useChapterStore()
  const nav = useNavigate();
  const { setOpen, setContent } = useExpandableSidebar();
  const [exportingPdf, setExportingPdf] = React.useState(false);
  const [pdfProgress, setPdfProgress] = React.useState<number>(0);
  const [pdfStatus, setPdfStatus] = React.useState<string>("");

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
      isMath: ctx.editor?.isActive("blockMath") ?? false
    }),
  });

  if (!editor || chapter?.frozen) return null;

  return (
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
              onClick={() => nav("/dashboard")}
            />
          </ButtonGroup>

          <div className="flex items-center gap-1">
            <ButtonGroup>
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
                title="bold"
                active={state?.isBold}
                onClick={() => editor.chain().focus().toggleBold().run()}
              />
              <Button
                icon={Italic}
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
                title="bullet list"
                active={state?.isBulletList}
                onClick={() => editor.chain().focus().toggleBulletList().run()}
              />
              <Button
                icon={ListOrdered}
                title="ordered list"
                active={state?.isOrderedList}
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
              />
            </ButtonGroup>

            <ButtonGroup>
              <Button
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
                title="image"
                icon={Image}
                active={state?.isImage}
                onClick={() => editor.chain().focus().addFigureImage("")}
              />
            </ButtonGroup>

            <ButtonGroup>
              <Button
                title="citation"
                icon={Quote}
                onClick={() => {
                  setContent("citation");
                  setOpen(true);
                }}
              />
              <Button
                icon={ScanText}
                title="scanner"
                onClick={() => {
                  setContent("scanner");
                  setOpen(true);
                }}
              />
              <Button
                icon={Search}
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

                  const docId =
                    Document.instance?.id ?? Chapter.instance?.document.id;
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

                  const unsubscribe = window.hightex.onPdfProgress((update) => {
                    const prog = update.progress ?? 0;
                    setPdfProgress(prog);
                    setPdfStatus(update.status);

                    toast.loading(renderProgressToast(update.status, prog), {
                      id: toastId,
                    });
                  });

                  try {
                    const result = await window.ipcRenderer.invoke(
                      "hightex:pdf",
                      docId,
                    );

                    if (!result) {
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
          </div>
        </div>
      </div>
    </div>
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
  disabled?: boolean;
  handleHover?: boolean;
  active?: boolean;
};

const Button: React.FC<ButtonProps & PropsWithChildren> = ({
  onClick,
  icon: Icon,
  title,
  disabled,
  children,
  handleHover = true,
  active = false,
}) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          title={title}
          disabled={disabled}
          className={`
        flex items-center justify-center
        w-8 h-8 p-1 rounded-md
        transition
        disabled:opacity-40 disabled:cursor-not-allowed

        text-neutral-700 dark:text-neutral-200
        ${active
              ? "bg-neutral-900/10 dark:bg-white/15 text-neutral-900 dark:text-white"
              : ""
            }
        ${handleHover ? "hover:bg-neutral-200 dark:hover:bg-neutral-700" : ""}
      `}
        >
          <Icon className={`w-3 h-3 ${disabled ? "animate-spin" : ""}`} />
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{title}</TooltipContent>
    </Tooltip>
  );
};
