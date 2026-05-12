import { NodeViewContent, NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { CornerUpLeft, CornerUpRight } from "lucide-react";
import { useState, useEffect } from "react";

export const ListItemComponent: React.FC<NodeViewProps> = ({
  editor,
  getPos,
  node,
}) => {
  const [isCursorInside, setIsCursorInside] = useState(false);

  const checkCursorPosition = () => {
    const nodeStart = getPos();
    if (!nodeStart) {
      return;
    }
    const nodeEnd = nodeStart + node.nodeSize;

    const { from, to } = editor.state.selection;
    const inside = from >= nodeStart && to <= nodeEnd;

    if (inside !== isCursorInside) {
      setIsCursorInside(inside);
    }
  };

  useEffect(() => {
    checkCursorPosition();
    editor.on("update", checkCursorPosition);
    editor.on("selectionUpdate", checkCursorPosition);

    return () => {
      editor.off("update", checkCursorPosition);
      editor.off("selectionUpdate", checkCursorPosition);
    };
  }, [editor, getPos, node.nodeSize, isCursorInside]);

  const lift = () => {
    editor.chain().focus().liftListItem("listItem").run();
  };
  const sink = () => {
    editor.chain().focus().sinkListItem("listItem").run();
  };

  return (
    <NodeViewWrapper as="li" className="relative group overflow-visible">
      <div
        className={`absolute -left-25 ${isCursorInside ? "flex" : "hidden"} h-6 justify-center space-x-1 items-center bg-gray-100 p-1 rounded-sm text-xs z-10`}
      >
        <button
          className="text-xs  w-4 h-4 cursor-pointer flex items-center justify-center"
          onClick={lift}
        >
          <CornerUpLeft size={10} />
        </button>
        <button
          className="text-xs  w-4 h-4 cursor-pointer flex items-center justify-center"
          onClick={sink}
          disabled={!editor.can().sinkListItem("listItem")}
        >
          <CornerUpRight size={10} />
        </button>
      </div>
      <NodeViewContent />
    </NodeViewWrapper>
  );
};
