import { HTMLAttributes, PropsWithChildren, forwardRef } from "react";

export const Paper = forwardRef<
  HTMLDivElement,
  PropsWithChildren & HTMLAttributes<HTMLDivElement> & { strictHeight?: boolean }
>(({ children, className, strictHeight, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={`shadow w-[21cm] ${strictHeight ? "h-[29.7cm]" : "min-h-[29.7cm]"} pt-[3cm] pr-[3cm] pl-[3cm] pb-[4cm] text-[12pt] bg-white ${className || ""}`}
      style={{ fontFamily: "'Times New Roman', serif" }}
      {...props}
    >
      {children}
    </div>
  );
});
