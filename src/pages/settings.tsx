import { useConfig } from "@/hooks/use-config";
import { PageHeader } from "@/components/dashboard/page-header";
import { AppInfoSection } from "@/components/settings/app-info-section";
import { CategorySection } from "@/components/settings/category-section";
import { DataSettings } from "@/components/settings/data-settings";
import {
  AppearanceSettings, EditorPreferences, ExportPreferences, ZoteroSettings,
} from "@/components/settings/preferences-settings";
import { t } from "@/utils/lang";

export function Settings() {
  const { config } = useConfig();
  if (!config) return null;

  return (
    <>
      <PageHeader title={t("settings.title")} description={t("settings.subtitle")} />
      <AppInfoSection />
      <AppearanceSettings />
      <EditorPreferences />
      <ExportPreferences />
      <ZoteroSettings />
      <CategorySection />
      <DataSettings />
    </>
  );
}
