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
  // Subscript,
  // Superscript,
  Table,
  Underline,
  Undo2,
} from "lucide-react";

import React, { PropsWithChildren } from "react";
import { Dropdown, DropdownItem } from "../dropdown";
import { useNavigate } from "react-router-dom";
import { useCurrentEditor } from "../../hooks/use-editor";
import { useExpandableSidebar } from "@/hooks/use-expandable-sidebar";
import { Document } from "@/editor/document";
import { toast } from "sonner";

export const NavBar: React.FC = () => {
  const { editor } = useCurrentEditor();
  const nav = useNavigate();
  const { setOpen, setContent } = useExpandableSidebar();

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
                icon={Undo2}
                onClick={() => editor.chain().focus().undo().run()}
              />
              <Button
                icon={Redo2}
                onClick={() => editor.chain().focus().redo().run()}
              />
            </ButtonGroup>

            <ButtonGroup>
              <Button
                icon={Heading2}
                onClick={() =>
                  editor.chain().focus().setHeading({ level: 2 }).run()
                }
              />
              <Button
                icon={Heading3}
                onClick={() =>
                  editor.chain().focus().setHeading({ level: 3 }).run()
                }
              />
              <Button
                icon={Heading4}
                onClick={() =>
                  editor.chain().focus().setHeading({ level: 4 }).run()
                }
              />
            </ButtonGroup>

            <ButtonGroup>
              <Button
                icon={Bold}
                onClick={() => editor.chain().focus().toggleBold().run()}
              />
              <Button
                icon={Italic}
                onClick={() => editor.chain().focus().toggleItalic().run()}
              />
              <Button
                icon={Underline}
                onClick={() => editor.chain().focus().toggleUnderline().run()}
              />
              <Button
                icon={Strikethrough}
                onClick={() => editor.chain().focus().toggleStrike().run()}
              />
            </ButtonGroup>

            <ButtonGroup>
              <Button
                icon={List}
                onClick={() => editor.chain().focus().toggleBulletList().run()}
              />
              <Button
                icon={ListOrdered}
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
              />
            </ButtonGroup>

            <ButtonGroup>
              <Button
                icon={Table}
                onClick={() => editor.chain()?.focus().insertContent({
                  type: "grid", content: [
                    { type: "gridRow", content: [{ type: "gridCell", content: [{ type: "paragraph", content: [{type:"text",text:"a cell"}] }] }] },
                    { type: "gridRow", content: [{ type: "gridCell", content: [{ type: "paragraph", content: [{type:"text",text:"a cell"}] }] }] },
                  ]
                }).run()}
              />
              <Button
                icon={Image}
                onClick={() => editor.chain().focus().addFigureImage("")}
              />
            </ButtonGroup>

            <ButtonGroup>
              <Dropdown trigger={<Button icon={Sigma} />}>
                <DropdownItem>Math Block</DropdownItem>
                <DropdownItem>Math Inline</DropdownItem>
              </Dropdown>

              <Button
                icon={Quote}
                onClick={() => {
                  setContent("citation");
                  setOpen(true);
                }}
              />
            </ButtonGroup>

            <ButtonGroup>
              <Button
                icon={ScanText}
                onClick={() => {
                  setContent("scanner");
                  setOpen(true);
                }}
              />
              <Button
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
};

const Button: React.FC<ButtonProps & PropsWithChildren> = ({
  onClick,
  icon: Icon,
  title,
  disabled,
  children,
  handleHover = true,
}) => {
  return (
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

        ${handleHover ? "hover:bg-neutral-200 dark:hover:bg-neutral-700" : ""}
      `}
    >
      <Icon className="w-3 h-3" />
      {children}
    </button>
  );
};
