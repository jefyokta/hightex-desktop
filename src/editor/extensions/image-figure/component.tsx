import { NodeViewContent, NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { Quote, Trash } from "lucide-react";
import { NodeActionButton } from "@/editor/components/node-action-button";
import { toast } from "sonner";
import { t, useAppLanguage } from "@/utils/lang";

export const ImageFigure: React.FC<NodeViewProps> = ({ node, deleteNode }) => {
  useAppLanguage();
  const copy = () => {
    if (typeof window === "undefined") return;
    window.navigator.clipboard.writeText(`@imageFigure[${node.attrs.id}]`);
  };

  const items = [
    {
      Icon: Quote,
      onClick: () => {
        copy();
        toast.success(t("editor.inline.copy_reference"));
      },
      label: t("editor.inline.copy_reference"),
    },
    {
      Icon: Trash,
      onClick: () => {
        deleteNode();
      },
      label: t("editor.inline.delete"),
      className:
        "text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 data-[selected='true']:bg-red-50 data-[selected='true']:dark:bg-red-950/50",
    },
  ];

  return (
    <NodeViewWrapper
      as="figure"
      data-type="imageFigure"
      id={node.attrs.id}
      className="relative w-full group"
      dragabble="true"
      data-copy={`@imageFigure[${node.attrs.id}]`}
    >
      <NodeActionButton
        className="hidden group-hover:flex"
        label={t("editor.inline.image_figure")}
        items={items}
      />
      <NodeViewContent className="w-full h-auto pointer-events-none-content group-hover:border group-hover:border-blue-600 group-hover:rounded" />
    </NodeViewWrapper>
  );
};
