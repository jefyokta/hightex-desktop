import { useAppLanguage } from "@/hooks/use-app-language";
import type { ChapterControlProps } from "@/editor/chapter/content-node-view";
import { Quote, Trash } from "lucide-react";
import { NodeActionButton } from "@/editor/components/node-action-button";
import { toast } from "sonner";
import { t } from "@/utils/lang";

export const ImageFigure: React.FC<ChapterControlProps> = ({
  node,
  deleteNode,
}) => {
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
    <NodeActionButton
      className="hidden group-hover:flex"
      label={t("editor.inline.image_figure")}
      items={items}
    />
  );
};
