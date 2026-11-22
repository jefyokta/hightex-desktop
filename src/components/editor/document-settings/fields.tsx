import { useId, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SettingsSection({ title, children, disabled, tour }: {
  title: string;
  children: ReactNode;
  disabled?: boolean;
  tour?: string;
}) {
  return (
    <Card data-tour={tour} className="bg-muted/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {disabled === undefined ? children : (
          <fieldset disabled={disabled} className="min-w-0 space-y-4">{children}</fieldset>
        )}
      </CardContent>
    </Card>
  );
}

export function SettingsField({ label, value, onChange }: {
  label: string;
  value: string;
  onChange(value: string): void;
}) {
  const id = useId();
  return (
    <div>
      <Label htmlFor={id} className="text-xs text-muted-foreground">{label}</Label>
      <Input id={id} className="mt-1 bg-muted/30" value={value}
        onChange={event => onChange(event.target.value)} />
    </div>
  );
}
