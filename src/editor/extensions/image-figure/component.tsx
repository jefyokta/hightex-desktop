import { useAppLanguage } from "@/hooks/use-app-language";
import type { ChapterControlProps } from "@/editor/chapter/content-node-view";
import { Image as ImageIcon, Quote, Trash } from "lucide-react";
import { NodeActionButton } from "@/editor/components/node-action-button";
import { toast } from "sonner";
import { t } from "@/utils/lang";
import { unwrapImageFigure } from "./unwrap";

export const ImageFigure: React.FC<ChapterControlProps> = ({
  node,
  deleteNode,
  editor,
  getPos,
}) => {
  useAppLanguage();
  const copy = () => {
    if (typeof window === "undefined") return;
    window.navigator.clipboard.writeText(`@imageFigure[${node.attrs.id}]`);
  };

  const items = [
    {
      Icon: ImageIcon,
      onClick: () => {
        const transaction = unwrapImageFigure(editor.state, getPos());
        if (transaction) editor.view.dispatch(transaction);
      },
      label: t("editor.inline.unwrap_figure"),
    },
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
      danger: true,
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
