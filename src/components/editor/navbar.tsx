import {
  ArrowLeftIcon,
  Bold,
  GitBranch,
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
  Subscript,
  Superscript,
  Table,
  Underline,
  Undo2,
} from "lucide-react";

import React, { PropsWithChildren } from "react";
import { Dropdown, DropdownItem } from "../dropdown";
import { useNavigate, useParams } from "react-router-dom";
import { EditorParams } from "../../types/params/editor";
import { useCurrentEditor } from "../../hooks/use-editor";

export const NavBar: React.FC = () => {
  // const { id, version } = useParams<EditorParams>()
  const { editor } = useCurrentEditor();
  const nav = useNavigate();

  if (!editor) return null;

  return (
    <div className="sticky top-0 z-50 max-w-max mx-auto bg-white/80 backdrop-blur border-b rounded-xl border-slate-200">
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
                onClick={() =>
                  editor.chain().focus().insertTable({ rows: 3, cols: 3 }).run()
                }
              />
              <Button
                icon={Image}
                onClick={() => {
                  editor.chain().focus().addFigureImage("");
                }}
              />
            </ButtonGroup>

            <ButtonGroup>
              <Dropdown trigger={<Button icon={Sigma} />}>
                <DropdownItem>Math Block</DropdownItem>
                <DropdownItem>Math Inline</DropdownItem>
              </Dropdown>

              <Button
                icon={Quote}
                onClick={() =>
                  editor
                    .chain()
                    .focus()
                    .insertContent({
                      type: "cite",
                      attrs: { cite: "okta2026pengembangan" },
                    })
                    .run()
                }
              />
            </ButtonGroup>

            <ButtonGroup>
              <Button icon={ScanText} />
            </ButtonGroup>
          </div>

          <ButtonGroup>
            <Button icon={GitBranch} />
          </ButtonGroup>
        </div>
      </div>
    </div>
  );
};

const ButtonGroup: React.FC<
  PropsWithChildren & {
    className?: string;
  }
> = ({ children, className }) => {
  return (
    <div
      className={`flex items-center gap-0 bg-gray-100  rounded-lg  overflow-hidden ${className ? className : ""}`}
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
      className={`flex items-center justify-center w-8 h-8 p-1 rounded-md ${handleHover && "hover:bg-gray-200"} transition  disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      <Icon className="w-3 h-3 text-slate-700" />
      {children}
    </button>
  );
};
