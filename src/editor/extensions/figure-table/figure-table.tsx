import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
// import { EventBus } from "@/Event/Bus";
import {
  Editor,
  NodeViewContent,
  NodeViewProps,
  NodeViewWrapper,
} from "@tiptap/react";
import { Copy, Delete } from "lucide-react";
import { useEffect, useState } from "react";

export const FigureTableComponent: React.FC<NodeViewProps> = ({
  node,
  editor,
  getPos,
  deleteNode,
}) => {
  const [insideNode, setInsideNode] = useState(false);
  const copy = () => {
    if (typeof window === "undefined") return;

    window.navigator.clipboard.writeText(`@figureTable[${node.attrs.id}]`);
  };

  useEffect(() => {
    const handler = ({ editor }: { editor: Editor }) => {
      const { from, to } = editor.state.selection;
      const pos = getPos();
      if (!pos) {
        return;
      }
      if (pos <= from && to <= pos + node.nodeSize) {
        setInsideNode(true);
      } else {
        setInsideNode(false);
      }
    };

    editor.on("selectionUpdate", handler);
    return () => {
      editor.off("selectionUpdate", handler);
    };
  }, [editor, getPos, node.nodeSize]);

  useEffect(() => {
    // EventBus.emit(`${node.type.name}:${node.attrs.id}`)
  }, []);

  return (
    <NodeViewWrapper
      style={{ overflow: "visible" }}
      className="relative border-indigo-500 dark:border-indigo-400"
      as="figure"
      data-type="figureTable"
      data-groupid={node.attrs.groupId || null}
      data-figureid={node.attrs.figureId}
      id={node.attrs.id}
      data-copy={`@figureTable[${node.attrs.id}]`}
    >
      <DropdownMenu>
        <DropdownMenuTrigger
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
            Figure Table
          </DropdownMenuLabel>

          <DropdownMenuSeparator className="bg-neutral-200 dark:bg-neutral-700" />

          <DropdownMenuItem
            onSelect={copy}
            className="text-neutral-800 dark:text-neutral-200 focus:bg-neutral-100 dark:focus:bg-neutral-800"
          >
            <Copy className="mr-2" />
            Copy Ref
          </DropdownMenuItem>

          <DropdownMenuItem
            onSelect={deleteNode}
            className="text-red-500 focus:bg-red-50 dark:focus:bg-red-950"
          >
            <Delete className="mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <NodeViewContent />
    </NodeViewWrapper>
  );
};
