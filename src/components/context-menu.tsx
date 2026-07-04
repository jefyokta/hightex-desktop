import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useContextMenuStore, ContextMenuItem } from "@/hooks/use-context-menu";
import { cn } from "@/lib/utils";

const ActionItem = ({
  item,
  close,
}: {
  item: Extract<ContextMenuItem, { label: string; onClick: () => void }>;
  close: () => void;
}) => (
  <button
    disabled={item.disabled}
    onMouseDown={(e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!item.disabled) {
        item.onClick();
        close();
      }
    }}
    className={cn(
      "relative flex w-full select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors",
      "focus:bg-accent focus:text-accent-foreground",
      item.disabled
        ? "pointer-events-none opacity-50"
        : item.danger
          ? "text-destructive hover:bg-destructive/10 dark:hover:bg-destructive/20"
          : "hover:bg-accent hover:text-accent-foreground cursor-pointer",
    )}
  >
    {item.icon && (
      <span className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground">
        {item.icon}
      </span>
    )}
    <span className="flex-1 text-left">{item.label}</span>
    {item.shortcut && (
      <span className="ml-auto text-xs tracking-widest text-muted-foreground">
        {item.shortcut}
      </span>
    )}
  </button>
);

export const ContextMenuPopup = () => {
  const { visible, x, y, items, close } = useContextMenuStore();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible) return;
    const onMouseDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) close();
    };
    const onScroll = () => close();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("scroll", onScroll, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [visible, close]);

  useEffect(() => {
    if (!visible || !menuRef.current) return;
    const el = menuRef.current;
    const { innerWidth, innerHeight } = window;
    const { width, height } = el.getBoundingClientRect();
    if (x + width > innerWidth) el.style.left = `${x - width}px`;
    else el.style.left = `${x}px`;
    if (y + height > innerHeight) el.style.top = `${y - height}px`;
    else el.style.top = `${y}px`;
  }, [visible, x, y]);

  if (!visible) return null;

  const renderItem = (item: ContextMenuItem, index: number) => {
    if (item.type === "separator") {
      return <div key={index} className="-mx-1 my-1 h-px bg-border" />;
    }

    if (item.type === "group") {
      return (
        <div key={index}>
          <p className="px-2 py-1 text-xs font-medium text-muted-foreground">
            {item.label}
          </p>
          {item.children.map((child, i) => (
            <ActionItem key={i} item={child} close={close} />
          ))}
        </div>
      );
    }

    return <ActionItem key={index} item={item} close={close} />;
  };

  return createPortal(
    <div
      ref={menuRef}
      style={{ position: "fixed", top: y, left: x, zIndex: 9999 }}
      className={cn(
        "min-w-45 max-w-60 overflow-hidden rounded-md border p-1",
        "bg-popover text-popover-foreground shadow-md",
        "animate-in fade-in-0 zoom-in-95",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
      )}
    >
      {items.map((item, i) => renderItem(item, i))}
    </div>,
    document.body,
  );
};
