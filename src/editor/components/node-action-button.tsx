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
    <Command className="rounded-lg border shadow-md text-left font-sans w-37.5">
      <CommandList>
        <CommandGroup heading={label || "Options"}>
          <CommandSeparator className="my-2" />
          {items.map((item, i) => (
            <CommandItem
              key={i}
              onSelect={() => handleActionClick(item.onClick)}
            >
              <item.Icon />
              {item.label}
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
        content={
          <ActionMenuContent
            label={label}
            items={actionItems}
            hide={hideTippy}
          />
        }
      >
        <button
          onClick={toggleVisibility}
          title="Node Actions"
          className="p-1 rounded-md cursor-pointer text-gray-700 bg-white shadow-md hover:bg-gray-100 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <GripVertical className="w-4 h-4" />
        </button>
      </Tippy>
    </div>
  );
};
