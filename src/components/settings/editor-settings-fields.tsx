import type { ReactNode } from "react";
import { t } from "@/utils/lang";
import { SettingSwitch } from "./setting-switch";

interface Props {
  value?: ConfigShape["editor"];
  onChange(patch: Partial<ConfigShape["editor"]>): void;
  paginationFeedback?: ReactNode;
}

/** Shared controls for app preferences and the editor's settings modal. */
export function EditorSettingsFields({ value, onChange, paginationFeedback }: Props) {
  const pagination = (
    <SettingSwitch
      label={t("settings.editor.pagination")}
      description={t("settings.editor.pagination_description")}
      value={value?.pagination ?? false}
      onChange={pagination => onChange({ pagination })}
    />
  );

  return (
    <>
      {paginationFeedback ? (
        <div data-tour="editor-pagination-setting" className="space-y-2">
          {pagination}
          {paginationFeedback}
        </div>
      ) : pagination}
      <SettingSwitch
        label={t("settings.editor.spell_check")}
        value={value?.spellCheck ?? false}
        onChange={spellCheck => onChange({ spellCheck })}
      />
      <SettingSwitch
        label={t("settings.editor.scrollbar")}
        value={value?.scrollBar ?? false}
        onChange={scrollBar => onChange({ scrollBar })}
      />
      <SettingSwitch
        label={t("settings.editor.table_resize_guides")}
        description={t("settings.editor.table_resize_guides_description")}
        value={value?.tableResizeGuides ?? true}
        onChange={tableResizeGuides => onChange({ tableResizeGuides })}
      />
      <SettingSwitch
        label={t("settings.editor.alias_hints")}
        description={t("settings.editor.alias_hints_description")}
        value={value?.aliasHint ?? false}
        onChange={aliasHint => onChange({ aliasHint })}
      />
    </>
  );
}
