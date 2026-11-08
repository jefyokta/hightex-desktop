import type { ComponentProps, ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./collapsible";

type DisclosureProps = ComponentProps<typeof Collapsible> & {
  label: ReactNode;
  triggerClassName?: string;
  contentClassName?: string;
};

export function Disclosure({
  label,
  children,
  triggerClassName,
  contentClassName,
  ...props
}: DisclosureProps) {
  return (
    <Collapsible {...props}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className={cn(
            "group/disclosure flex w-full items-center justify-between gap-3 rounded-md py-1 text-left text-sm font-medium text-foreground outline-none transition-colors hover:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            triggerClassName,
          )}
        >
          <span className="min-w-0 flex-1">{label}</span>
          <ChevronDown
            aria-hidden="true"
            className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]/disclosure:rotate-180 motion-reduce:transition-none"
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent
        forceMount
        className={cn("data-[state=closed]:hidden", contentClassName)}
      >
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
