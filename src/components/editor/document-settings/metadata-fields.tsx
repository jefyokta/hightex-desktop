import { useId, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DocumentSettingsPatch } from "@/hooks/use-document-settings";
import { ParsedItalic } from "@/utils/parse-italic";
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

export function DocumentKeywordFields({ value, onChange }: {
  value: HighTexDocument["keywords"];
  onChange(keywords: HighTexDocument["keywords"]): void;
}) {
  return (
    <SettingsSection title={t("editor.expandable.setting.keywords")}>
      <KeywordInput label={t("editor.expandable.setting.indonesian")} values={value.indonesian}
        onChange={indonesian => onChange({ ...value, indonesian })}
        render={keyword => <ParsedItalic text={keyword} />} />
      <KeywordInput label={t("editor.expandable.setting.english")} values={value.english}
        onChange={english => onChange({ ...value, english })}
        render={keyword => <em>{keyword}</em>} />
    </SettingsSection>
  );
}

function KeywordInput({ label, values, onChange, render }: {
  label: string;
  values: string[];
  onChange(values: string[]): void;
  render(value: string): ReactNode;
}) {
  const id = useId();
  const [input, setInput] = useState("");
  const add = () => {
    const value = input.trim();
    if (!value || values.includes(value) || values.length >= 5) return;
    onChange([...values, value]);
    setInput("");
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex flex-wrap gap-2">
        {values.map(value => (
          <Badge key={value} variant="secondary" className="gap-1 px-2 py-1">
            {render(value)}
            <button type="button" aria-label={t("dashboard.remove_keyword", { keyword: value })}
              onClick={() => onChange(values.filter(item => item !== value))}
              className="opacity-70 transition-opacity hover:opacity-100">
              <X className="size-3" />
            </button>
          </Badge>
        ))}
      </div>
      <Input id={id} value={input} placeholder={t("editor.expandable.setting.add_keyword")}
        onChange={event => setInput(event.target.value)}
        onKeyDown={event => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          add();
        }} />
    </div>
  );
}
