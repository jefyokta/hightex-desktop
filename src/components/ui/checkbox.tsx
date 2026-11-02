import * as React from "react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import { CheckIcon, MinusIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(function Checkbox({ className, checked, ...props }, ref) {
  return (
    <CheckboxPrimitive.Root
      ref={ref}
      data-slot="checkbox"
      checked={checked}
      className={cn(
        "group/checkbox peer relative inline-flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border border-input bg-background text-background shadow-xs transition-colors outline-none after:absolute after:-inset-2 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive data-[state=checked]:border-foreground data-[state=checked]:bg-foreground data-[state=indeterminate]:border-foreground data-[state=indeterminate]:bg-foreground",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="pointer-events-none grid place-content-center"
      >
        <CheckIcon
          className="size-3.5 group-data-[state=indeterminate]/checkbox:hidden"
          strokeWidth={2.5}
        />
        <MinusIcon
          className="hidden size-3.5 group-data-[state=indeterminate]/checkbox:block"
          strokeWidth={2.5}
        />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
});

export { Checkbox };
