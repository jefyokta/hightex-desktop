import { useId, type ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface Props {
  label: ReactNode;
  description?: string;
  value?: boolean;
  onChange?(value: boolean): void;
}

export function SettingSwitch({ label, description, value = false, onChange }: Props) {
  const id = useId();
  return (
    <div className="flex items-center justify-between">
      <div className="space-y-0.5">
        <Label htmlFor={id}>{label}</Label>
        {description && (
          <p id={`${id}-description`} className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <Switch id={id} checked={value} onCheckedChange={onChange}
        aria-describedby={description ? `${id}-description` : undefined} />
    </div>
  );
}
