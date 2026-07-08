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
  Strikethrough,
  Table,
  Underline,
  Undo2,
} from "lucide-react";

import React, { PropsWithChildren } from "react";
import { useNavigate } from "react-router-dom";
import { useCurrentEditor } from "../../hooks/use-editor";
import { useExpandableSidebar } from "@/hooks/use-expandable-sidebar";
import { Document } from "@/editor/document";
import { toast } from "sonner";
import { createFigureTable } from "@/editor/utils/create-figure-table";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { useEditorState } from "@tiptap/react";

export const NavBar: React.FC = () => {
  const { editor } = useCurrentEditor();
  const nav = useNavigate();
  const { setOpen, setContent } = useExpandableSidebar();

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
    }),
  });

  if (!editor) return null;

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
                title="grid"
                icon={Table}
                active={state?.isGrid}
                onClick={() =>
                  editor
                    .chain()
                    ?.focus()
                    .insertContent({
                      type: "grid",
                      content: [
                        {
                          type: "gridRow",
                          content: [
                            {
                              type: "gridCell",
                              content: [
                                {
                                  type: "paragraph",
                                  content: [{ type: "text", text: "a cell" }],
                                },
                              ],
                            },
                            {
                              type: "gridCell",
                              content: [
                                {
                                  type: "paragraph",
                                  content: [{ type: "text", text: "a cell" }],
                                },
                              ],
                            },
                            {
                              type: "gridCell",
                              content: [
                                {
                                  type: "paragraph",
                                  content: [{ type: "text", text: "a cell" }],
                                },
                              ],
                            },
                          ],
                        },
                        {
                          type: "gridRow",
                          content: [
                            {
                              type: "gridCell",
                              content: [
                                {
                                  type: "paragraph",
                                  content: [{ type: "text", text: "a cell" }],
                                },
                              ],
                            },
                            {
                              type: "gridCell",
                              content: [
                                {
                                  type: "paragraph",
                                  content: [{ type: "text", text: "a cell" }],
                                },
                              ],
                            },
                            {
                              type: "gridCell",
                              content: [
                                {
                                  type: "paragraph",
                                  content: [{ type: "text", text: "a cell" }],
                                },
                              ],
                            },
                          ],
                        },
                      ],
                    })
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
                title="download pdf"
                icon={DownloadCloudIcon}
                onClick={async () => {
                  const toastId = toast.loading("Preparing PDF export...");
                  const unsubscribe = window.hightex.onPdfProgress((update) => {
                    toast(update.status, { id: toastId });
                  });

                  try {
                    const result = await window.ipcRenderer.invoke(
                      "hightex:pdf",
                      Document.instance?.id,
                    );

                    if (!result) {
                      toast.dismiss(toastId);
                      return;
                    }

                    toast.success(`Saved ${result.filename}`, { id: toastId });
                  } catch (error) {
                    toast.error("Error while exporting PDF", { id: toastId });
                  } finally {
                    unsubscribe();
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
        ${
          active
            ? "bg-neutral-900/10 dark:bg-white/15 text-neutral-900 dark:text-white"
            : ""
        }
        ${handleHover ? "hover:bg-neutral-200 dark:hover:bg-neutral-700" : ""}
      `}
        >
          <Icon className="w-3 h-3" />
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{title}</TooltipContent>
    </Tooltip>
  );
};
