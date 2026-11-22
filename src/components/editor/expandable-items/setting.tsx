import { FileWarning, Save } from "lucide-react";
import { useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAppLanguage } from "@/hooks/use-app-language";
import { useDocumentSettings } from "@/hooks/use-document-settings";
import { ParsedItalic } from "@/utils/parse-italic";
import { openProfileInMainWindow } from "@/utils/open-profile-in-main-window";
import { t } from "@/utils/lang";
import { DocumentKeywordFields, DocumentMetadataFields } from "../document-settings/metadata-fields";
import { FacultyOfficialFields, InternshipFields, ThesisDateFields } from "../document-settings/config-fields";
import { WorkspaceProfileSection } from "../document-settings/workspace-profile-section";
import { TabHeader } from "./components/tab-header";

export function Setting() {
  useAppLanguage();
  const { id } = useParams();
  const settings = useDocumentSettings(id);
  const { document, dirty, saving, academic } = settings;
  if (!document) return null;

  return (
    <div data-tour="editor-document-settings" className="flex h-full flex-col bg-background">
      <TabHeader title={t("editor.expandable.setting.title")} desc={<ParsedItalic text={document.title} />}>
        <div className="flex items-center justify-end gap-1">
          {dirty && (
            <Badge className="gap-1 border-yellow-500/20 bg-yellow-500/10 text-yellow-700 dark:border-yellow-400/20 dark:bg-yellow-400/10 dark:text-yellow-300">
              <FileWarning className="size-1.5" />
              {t("editor.expandable.setting.unsaved")}
            </Badge>
          )}
          <Button data-tour="document-settings-save" size="sm" variant="outline"
            disabled={!dirty || saving} onClick={() => void settings.save()} className="gap-1">
            <Save className="size-3" />
            {t(saving ? "editor.expandable.setting.saving" : "editor.expandable.setting.save")}
          </Button>
        </div>
      </TabHeader>
      <div className="flex-1 space-y-4 overflow-auto p-4">
        <DocumentMetadataFields value={document} categories={settings.categories}
          onChange={settings.update} onCategoryChange={settings.selectCategory} />
        {academic.locked && (
          <p role="status" className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
            {t(academic.error ? "cloud_academic.unavailable" : "cloud_academic.readonly")}
          </p>
        )}
        <WorkspaceProfileSection profile={document.profile} onEdit={() => void openProfileInMainWindow()} />
        <DocumentKeywordFields value={document.keywords} onChange={keywords => settings.update({ keywords })} />
        <FacultyOfficialFields value={document.config} disabled={academic.locked} onChange={settings.updateConfig} />
        <ThesisDateFields value={document.config} onChange={settings.updateConfig} />
        {settings.isIntern && (
          <InternshipFields value={document.config.intern} onChange={intern => settings.updateConfig({ intern })} />
        )}
      </div>
    </div>
  );
}
