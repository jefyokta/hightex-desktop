import React, { useState, useCallback } from "react";
import Tippy from "@tippyjs/react";
import { GripVertical } from "lucide-react";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

type NodeAction = {
  Icon?: any;
  onClick: () => any;
  label: string;
};

type NodeActionButtonProps = {
  className?: string;
  items?: NodeAction[];
  label?: string;
};

const ActionMenuContent: React.FC<{
  items: NodeAction[];
  hide: () => void;
  label?: string;
}> = ({ items, hide, label }) => {
  const handleActionClick = (onClick: () => any) => {
    onClick();
    hide();
  };

  return (
    <Command className="rounded-lg border border-neutral-200 dark:border-neutral-800 shadow-md text-left font-sans w-37.5 bg-white dark:bg-neutral-950 text-neutral-950 dark:text-neutral-50">
      <CommandList>
        <CommandGroup heading={label || "Options"}>
          <CommandSeparator className="my-2 bg-neutral-100 dark:bg-neutral-800" />
          {items.map((item, i) => (
            <CommandItem
              key={i}
              onSelect={() => handleActionClick(item.onClick)}
              className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm cursor-pointer select-none outline-none hover:bg-neutral-100 dark:hover:bg-neutral-800 focus:bg-neutral-100 dark:focus:bg-neutral-800 data-[selected='true']:bg-neutral-100 data-[selected='true']:dark:bg-neutral-800"
            >
              {item.Icon && (
                <item.Icon className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
              )}
              <span>{item.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
};

export const NodeActionButton: React.FC<NodeActionButtonProps> = ({
  className,
  items,
  label,
}) => {
  const actionItems = items || [];
  const [isVisible, setIsVisible] = useState(false);

  const toggleVisibility = useCallback(() => {
    setIsVisible((prev) => !prev);
  }, []);

  const hideTippy = useCallback(() => {
    setIsVisible(false);
  }, []);

  if (actionItems.length === 0) {
    return null;
  }

  return (
    <div
      className={`absolute top-2 right-2 flex items-center justify-center z-20 ${className}`}
    >
      <Tippy
        visible={isVisible}
        onClickOutside={hideTippy}
        trigger="manual"
        interactive={true}
        placement="bottom-end"
        arrow={false}
        offset={[0, 8]}
        render={(attrs) => (
          <div {...attrs}>
            <ActionMenuContent
              label={label}
              items={actionItems}
              hide={hideTippy}
            />
          </div>
        )}
      >
        <button
          onClick={toggleVisibility}
          title="Node Actions"
          className="p-1 rounded-md cursor-pointer text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 shadow-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
        >
          <GripVertical className="w-4 h-4" />
        </button>
      </Tippy>
    </div>
  );
};
