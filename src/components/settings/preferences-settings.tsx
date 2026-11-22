import { Folder, Monitor, Moon, Sun } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useConfig } from "@/hooks/use-config";
import { LANGUAGE_OPTIONS, t } from "@/utils/lang";
import { EditorSettingsFields } from "./editor-settings-fields";
import { SettingSwitch } from "./setting-switch";

export function AppearanceSettings() {
  const { config, saveConfig } = useConfig();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.appearance")}</CardTitle>
        <CardDescription>{t("settings.appearance.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>{t("settings.language")}</Label>
            <p className="text-xs text-muted-foreground">{t("settings.language.description")}</p>
          </div>
          <Select value={config?.language ?? "en"} onValueChange={(language: SupportedLanguage) => saveConfig({ language })}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              {LANGUAGE_OPTIONS.map(option => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>{t("settings.theme")}</Label>
            <p className="text-xs text-muted-foreground">{t("settings.theme.description")}</p>
          </div>
          <Select value={config?.theme ?? "system"} onValueChange={(theme: ThemeMode) => saveConfig({ theme })}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="light"><div className="flex items-center gap-2"><Sun size={14} />{t("common.light")}</div></SelectItem>
              <SelectItem value="dark"><div className="flex items-center gap-2"><Moon size={14} />{t("common.dark")}</div></SelectItem>
              <SelectItem value="system"><div className="flex items-center gap-2"><Monitor size={14} />{t("common.system")}</div></SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}

export function EditorPreferences() {
  const { config, saveConfig } = useConfig();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.editor.title")}</CardTitle>
        <CardDescription>{t("settings.editor.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <EditorSettingsFields value={config?.editor} onChange={editor => saveConfig({ editor })} />
      </CardContent>
    </Card>
  );
}

export function ExportPreferences() {
  const { config, saveConfig } = useConfig();
  const chooseFolder = async () => {
    const saveFolder = await window.dialog.selectFolder();
    if (saveFolder) await saveConfig({ export: { saveFolder } });
  };

  return (
    <Card data-tour="export-settings">
      <CardHeader>
        <CardTitle>{t("settings.export.export")}</CardTitle>
        <CardDescription>{t("settings.export.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SettingSwitch
          label={t("settings.export.export")}
          description={t("settings.export.description")}
          value={config?.export?.saveDialog ?? false}
          onChange={saveDialog => saveConfig({ export: { saveDialog } })}
        />
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-0.5">
              <Label>{t("settings.export.default_folder.label")}</Label>
              <p className="text-xs text-muted-foreground">{t("settings.export.default_folder.description")}</p>
            </div>
            <button
              onClick={() => void chooseFolder()}
              className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 dark:bg-neutral-800 text-white px-3 py-2 text-xs hover:bg-neutral-800 dark:hover:bg-neutral-700 transition"
            >
              <Folder size={14} />{t("settings.export.choose_folder")}
            </button>
          </div>
          <Input value={config?.export?.saveFolder ?? ""}
            onChange={event => saveConfig({ export: { saveFolder: event.target.value } })} />
        </div>
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-0.5">
              <Label>{t("settings.export.timeout")}</Label>
              <p className="text-xs text-muted-foreground">{t("settings.export.timeout_description")}</p>
            </div>
          </div>
          <Input type="number" value={config?.export?.exportTimeout ?? "120000"}
            onChange={event => saveConfig({ export: { exportTimeout: Number(event.target.value) } })} />
        </div>
      </CardContent>
    </Card>
  );
}

export function ZoteroSettings() {
  const { config, saveConfig } = useConfig();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.zotero.zotero")}</CardTitle>
        <CardDescription>{t("settings.zotero.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SettingSwitch
          label={t("settings.zotero.enable.label")}
          description={t("settings.zotero.enable.description")}
          value={config?.zotero?.enabled ?? false}
          onChange={enabled => saveConfig({ zotero: { enabled } })}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-0.5">
            <Label>{t("settings.zotero.host.label")}</Label>
            <p className="text-xs text-muted-foreground">{t("settings.zotero.host.description")}{" "}</p>
          </div>
          <Input value={config?.zotero?.host ?? "127.0.0.1"}
            onChange={event => saveConfig({ zotero: { host: event.target.value } })} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-0.5">
            <Label>{t("settings.zotero.port.label")}</Label>
            <p className="text-xs text-muted-foreground">{t("settings.zotero.port.description")}{" "}</p>
          </div>
          <Input type="number" min={1} max={65535} value={config?.zotero?.port ?? 23119}
            onChange={event => saveConfig({ zotero: { port: Number(event.target.value) || 23119 } })} />
        </div>
        <Separator />
        <div className="rounded-3xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
          <p className="font-semibold">{t("settings.zotero.how_to_enable.label")}</p>
          <p className="mt-2 text-xs text-muted-foreground">{t("settings.zotero.how_to_enable.description")}</p>
          <img src="/enabling-zotero-apis.png" alt={t("settings.zotero.how_to_enable.label")}
            className="mt-4 w-full rounded-2xl border border-neutral-200 dark:border-neutral-800" />
        </div>
      </CardContent>
    </Card>
  );
}
