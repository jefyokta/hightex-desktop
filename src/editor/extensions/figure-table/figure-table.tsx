import { useAppLanguage } from "@/hooks/use-app-language";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Editor } from "@tiptap/react";
import type { ChapterControlProps } from "@/editor/chapter/content-node-view";
import { Copy, Delete } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { t } from "@/utils/lang";

export const FigureTableComponent: React.FC<ChapterControlProps> = ({
  node,
  editor,
  getPos,
  deleteNode,
}) => {
  useAppLanguage();
  const [insideNode, setInsideNode] = useState(false);
  const copy = () => {
    if (typeof window === "undefined") return;
    window.navigator.clipboard.writeText(`@figureTable[${node.attrs.id}]`);
    toast.success(t("editor.inline.copy_reference"));
  };

  useEffect(() => {
    const handler = ({ editor }: { editor: Editor }) => {
      const { from, to } = editor.state.selection;
      const pos = getPos();
      if (pos === undefined) {
        return;
      }
      if (pos <= from && to <= pos + node.nodeSize) {
        setInsideNode(true);
      } else {
        setInsideNode(false);
      }
    };

    handler({ editor });
    editor.on("selectionUpdate", handler);
    return () => {
      editor.off("selectionUpdate", handler);
    };
  }, [editor, getPos, node.nodeSize]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        data-editor-ui
        contentEditable={false}
        className={`absolute ${
          insideNode ? "visible opacity-100" : "invisible opacity-0"
        } -right-10 p-1 cursor-pointer px-0.5 text-neutral-500 dark:text-neutral-400 transition-200 ease-in rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="lucide lucide-grip-vertical w-4 h-4"
        >
          <circle cx="9" cy="12" r="1" />
          <circle cx="9" cy="5" r="1" />
          <circle cx="9" cy="19" r="1" />
          <circle cx="15" cy="12" r="1" />
          <circle cx="15" cy="5" r="1" />
          <circle cx="15" cy="19" r="1" />
        </svg>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
        <DropdownMenuLabel className="text-neutral-700 dark:text-neutral-300">
          {t("editor.inline.figure_table")}
        </DropdownMenuLabel>

        <DropdownMenuSeparator className="bg-neutral-200 dark:bg-neutral-700" />

        <DropdownMenuItem
          onSelect={copy}
          className="text-neutral-800 dark:text-neutral-200 focus:bg-neutral-100 dark:focus:bg-neutral-800"
        >
          <Copy className="mr-2" />
          {t("editor.inline.copy_reference")}
        </DropdownMenuItem>

        <DropdownMenuItem
          onSelect={deleteNode}
          className="text-red-500 focus:bg-red-50 dark:focus:bg-red-950"
        >
          <Delete className="mr-2" />
          {t("editor.inline.delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
