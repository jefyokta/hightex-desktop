import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import type { CSSProperties } from "react";

export const abbreviationColumns = "6.5cm .5cm 7cm";
const fittingColumns = abbreviationColumns
  .split(" ")
  .map((width, index) => (index === 1 ? width : `minmax(0, ${width})`))
  .join(" ");

export function AbbreviationRow({
  item,
  onRemove,
  standalone = false,
}: {
  item: Pick<Alias, "key" | "value">;
  onRemove?(): void;
  standalone?: boolean;
}) {
  return (
    <div
      data-abbreviation-row={standalone ? "" : undefined}
      style={
        {
          display: standalone ? "grid" : "contents",
          gridTemplateColumns: standalone
            ? `var(--abbreviation-columns, ${abbreviationColumns})`
            : abbreviationColumns,
          ...(standalone
            ? { "--abbreviation-fit-columns": fittingColumns }
            : {}),
        } as CSSProperties
      }
    >
      <div className="text-elipsis">{item.key}</div>
      <div>:</div>
      <div className="relative">
        {item.value}
        {onRemove && (
          <Button
            onClick={onRemove}
            className="absolute -right-10 z-10 top-0 w-5 h-5 rounded-full"
            variant="destructive"
          >
            <X className="w-1" width="16" height="16" />
          </Button>
        )}
      </div>
    </div>
  );
}
