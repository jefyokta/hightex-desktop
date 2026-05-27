import { cn } from "@/lib/utils";
import React, { useEffect, useRef, useState } from "react";

type DropdownProps = {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: "left" | "right";
  zIndex?: number;
  width?: number | string;
  className?: string;
};
type ItemProps = {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
};
export const Dropdown: React.FC<DropdownProps> = ({
  trigger,
  children,
  align = "left",
  zIndex = 50,
  width = 160,
  className = "",
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={cn("relative inline-block")} ref={ref}>
      <div onClick={() => setOpen((prev) => !prev)} className="cursor-pointer">
        {trigger}
      </div>

      {open && (
        <div
          className={`absolute mt-2 rounded-xl ${className} overflow-hidden bg-background shadow-lg border  ${
            align === "right" ? "right-0" : "left-0"
          }`}
          style={{
            width: typeof width === "number" ? `${width}px` : width,
            zIndex,
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
};
export const DropdownItem: React.FC<ItemProps> = ({
  children,
  onClick,
  disabled,
}) => {
  return (
    <div
      onClick={() => {
        if (disabled) return;
        onClick && onClick();
      }}
      className="w-full cursor-pointer text-left px-3 py-2 rounded-lg text-sm text-neutral-700 p-2 transition disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {children}
    </div>
  );
};
