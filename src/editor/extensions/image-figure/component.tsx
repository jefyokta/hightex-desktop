import { NodeViewContent, NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { useEffect } from "react";
import { Quote, Trash } from "lucide-react";
import { NodeActionButton } from "@/editor/components/node-action-button";
export const ImageFigure: React.FC<NodeViewProps> = ({ node, deleteNode }) => {
  useEffect(() => {
    // EventBus.emit(`${node.type.name}:${node.attrs.id}`);
  }, [node.attrs.id, node.type.name]);

  const copy = () => {
    if (typeof window === "undefined") return;

    window.navigator.clipboard.writeText(`@imageFigure[${node.attrs.id}]`);
  };

  const items = [
    {
      Icon: Quote,
      onClick: () => {
        copy();
      },
      label: "Quote",
    },
    {
      Icon: Trash,
      onClick: () => {
        deleteNode();
      },
      label: "Delete",
    },
  ];

  return (
    <NodeViewWrapper
      as="figure"
      data-type="imageFigure"
      id={node.attrs.id}
      className="relative w-full group "
      dragabble="true"
      data-copy={`@imageFigure[${node.attrs.id}]`}
    >
      <NodeActionButton
        className="hidden group-hover:flex"
        label="Figure Image"
        items={items}
      />
      <NodeViewContent className="w-full  h-auto pointer-events-none-content  group-hover:border group-hover:border-blue-600 group-hover:rounded" />
    </NodeViewWrapper>
  );
};
