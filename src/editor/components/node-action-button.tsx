import { useAppLanguage } from "@/hooks/use-app-language";
import { GripVertical, type LucideIcon } from "lucide-react";
import { t } from "@/utils/lang";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NodeAction = {
  Icon?: LucideIcon;
  onClick: () => void;
  label: string;
  danger?: boolean;
};

type NodeActionButtonProps = {
  className?: string;
  items?: NodeAction[];
  label?: string;
};

export const NodeActionButton: React.FC<NodeActionButtonProps> = ({
  className,
  items = [],
  label,
}) => {
  useAppLanguage();
  if (!items.length) return null;

  return (
    <div
      data-editor-ui
      contentEditable={false}
      className={`absolute top-2 right-2 flex items-center justify-center z-20 ${className ?? ""}`}
    >
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            title={t("editor.inline.node_actions")}
            aria-label={t("editor.inline.node_actions")}
            className="p-1 rounded-md cursor-pointer text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 shadow-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 focus-visible:ring-2 focus-visible:ring-blue-500 dark:focus-visible:ring-blue-400"
          >
            <GripVertical className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={8}
          className="w-max min-w-64 max-w-[calc(100vw-1rem)] font-sans"
          onCloseAutoFocus={event => event.preventDefault()}
        >
          <DropdownMenuLabel>{label ?? t("editor.inline.options")}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {items.map(({ Icon, onClick, label, danger }) => (
            <DropdownMenuItem
              key={label}
              onSelect={onClick}
              variant={danger ? "destructive" : "default"}
              className="gap-2 px-2 py-2"
            >
              {Icon && <Icon className="size-4" />}
              <span>{label}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
