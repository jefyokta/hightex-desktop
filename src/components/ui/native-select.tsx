import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export const NativeSelect = React.forwardRef<
  HTMLSelectElement,
  React.ComponentPropsWithoutRef<"select"> & { wrapperClassName?: string }
>(function NativeSelect(
  { className, wrapperClassName, children, ...props },
  ref,
) {
  return (
    <div className={cn("relative min-w-0", wrapperClassName)}>
      <select
        ref={ref}
        className={cn(
          "block h-10 w-full min-w-0 appearance-none truncate rounded-lg border border-input bg-background py-2 pl-3 pr-10 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
});
