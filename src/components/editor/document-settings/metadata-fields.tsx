import { useId } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DocumentSettingsPatch } from "@/hooks/use-document-settings";
import { t } from "@/utils/lang";
import { SettingsField, SettingsSection } from "./fields";

export function DocumentMetadataFields({ value, categories, onChange, onCategoryChange }: {
  value: Pick<HighTexDocument, "title" | "altTitle" | "category">;
  categories: Category[];
  onChange(patch: DocumentSettingsPatch): void;
  onCategoryChange(category: string): void;
}) {
  const categoryId = useId();
  return (
    <SettingsSection title={t("editor.expandable.setting.document")}>
      <SettingsField label={t("editor.expandable.setting.title_label")} value={value.title ?? ""}
        onChange={title => onChange({ title })} />
      <SettingsField label={t("editor.expandable.setting.alt_title")} value={value.altTitle ?? ""}
        onChange={altTitle => onChange({ altTitle })} />
      <div className="space-y-2">
        <Label htmlFor={categoryId} className="text-xs text-muted-foreground">
          {t("editor.expandable.setting.category")}
        </Label>
        <Select value={value.category} onValueChange={onCategoryChange}>
          <SelectTrigger id={categoryId} className="mt-1 w-full">
            <SelectValue placeholder={t("editor.expandable.setting.select_category")} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {categories.map(category => (
                <SelectItem key={category.id} value={String(category.id)}>
                  {category.name} · {t(`common.${category.variant}`)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    </SettingsSection>
  );
}
