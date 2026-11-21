import { forwardRef, type ComponentPropsWithoutRef } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

type ToolbarButtonProps = ComponentPropsWithoutRef<"button"> & {
  icon: LucideIcon;
  tour?: string;
  active?: boolean;
  handleHover?: boolean;
  spinnable?: boolean;
};

export const ToolbarButton = forwardRef<HTMLButtonElement, ToolbarButtonProps>(
  function ToolbarButton({
    icon: Icon, tour, active = false, handleHover = true, spinnable = true,
    title, disabled, className, children, ...props
  }, ref) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            ref={ref}
            type="button"
            data-tour={tour}
            title={title}
            aria-label={title}
            disabled={disabled}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-md p-1 text-neutral-700 transition disabled:cursor-not-allowed disabled:opacity-40 dark:text-neutral-200",
              active && "bg-neutral-900/10 text-neutral-900 dark:bg-white/15 dark:text-white",
              handleHover && "hover:bg-neutral-200 dark:hover:bg-neutral-700",
              className,
            )}
            {...props}
          >
            <Icon className={cn("size-3", disabled && spinnable && "animate-spin")} />
            {children}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{title}</TooltipContent>
      </Tooltip>
    );
  },
);
