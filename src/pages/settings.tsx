import { PageHeader } from "@/components/dashboard/page-header";
import licenseText from "../../LICENSE?raw";
import copyrightNotice from "../../COPYRIGHT?raw";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useEffect, useState } from "react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  AlertCircle,
  CheckCircle,
  Download,
  Folder,
  Loader2,
  Monitor,
  Moon,
  RefreshCw,
  Sun,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cleanUnusedProgress } from "@/utils/clean-unused-data";
import { HighTexDB } from "@/editor/storage/hightex-db";
import { LANGUAGE_OPTIONS, t, type SupportedLanguage } from "@/utils/lang";
import { executeInteractively } from "@/utils/execute-interactively";
import { useCitationCleanup } from "@/hooks/use-citation-cleanup";

export const Settings = () => {
  const { cleaning, deleteUnusedCitations } = useCitationCleanup();
  const [config, setConfig] = useState<ConfigShape | null>(null);

  const [theme, setTheme] = useState<ThemeMode>("system");
  const [language, setLanguage] = useState<SupportedLanguage>("en");

  useEffect(() => {
    const init = window.config.get();

    if (init) {
      setConfig(init);
      setTheme(init.theme);
      setLanguage(init.language ?? "en");
    }

    return window.config.onChange((cnfg) => {
      setConfig(cnfg);
      setTheme(cnfg.theme);
      setLanguage(cnfg.language ?? "en");
    });
  }, []);

  const patchConfig = async (patch: Partial<ConfigShape>) => {
    const updated = await window.config.set(patch);

    setConfig(updated);
  };

  const changeTheme = async (mode: ThemeMode) => {
    setTheme(mode);

    await patchConfig({
      theme: mode,
    });
  };

  const changeLanguage = async (mode: SupportedLanguage) => {
    setLanguage(mode);

    await patchConfig({
      language: mode,
    });
  };

  if (!config) return null;

  return (
    <>
      <PageHeader
        title={t("settings.title")}
        description={t("settings.subtitle")}
      />
      <AppInfoSection />
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.appearance")}</CardTitle>
          <CardDescription>
            {t("settings.appearance.description")}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{t("settings.language")}</Label>
              <p className="text-xs text-muted-foreground">
                {t("settings.language.description")}
              </p>
            </div>

            <Select value={language} onValueChange={changeLanguage}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                {LANGUAGE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{t("settings.theme")}</Label>
              <p className="text-xs text-muted-foreground">
                {t("settings.theme.description")}
              </p>
            </div>

            <Select value={theme} onValueChange={changeTheme}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="light">
                  <div className="flex items-center gap-2">
                    <Sun size={14} />
                    {t("common.light")}
                  </div>
                </SelectItem>

                <SelectItem value="dark">
                  <div className="flex items-center gap-2">
                    <Moon size={14} />
                    {t("common.dark")}
                  </div>
                </SelectItem>

                <SelectItem value="system">
                  <div className="flex items-center gap-2">
                    <Monitor size={14} />
                    {t("common.system")}
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.editor.title")}</CardTitle>
          <CardDescription>{t("settings.editor.description")}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <SettingSwitch
            label={t("settings.editor.pagination")}
            description={t("settings.editor.pagination_description")}
            value={config.editor?.pagination ?? false}
            onChange={(value) =>
              patchConfig({ editor: { ...config.editor, pagination: value } })
            }
          />
          <SettingSwitch
            label={t("settings.editor.spell_check")}
            value={config.editor?.spellCheck ?? false}
            onChange={async (val) => {
              await patchConfig({
                editor: {
                  ...config.editor,
                  spellCheck: val,
                },
              });
            }}
          />
          <SettingSwitch
            label={t("settings.editor.scrollbar")}
            value={config.editor?.scrollBar ?? false}
            onChange={async (val) => {
              await patchConfig({
                editor: {
                  ...config.editor,
                  scrollBar: val,
                },
              });
            }}
          />

          <SettingSwitch
            label={t("settings.editor.table_resize_guides")}
            description={t("settings.editor.table_resize_guides_description")}
            value={config.editor?.tableResizeGuides ?? true}
            onChange={async (val) => {
              await patchConfig({
                editor: {
                  ...config.editor,
                  tableResizeGuides: val,
                },
              });
            }}
          />

          <SettingSwitch
            label={
              <>
                {/* 
              note for translator: alias = singkatan
               */}
                <span>{t("settings.editor.alias_hints")}</span>
              </>
            }
            description={t("settings.editor.alias_hints_description")}
            value={config.editor?.aliasHint ?? false}
            onChange={async (val) => {
              await patchConfig({
                editor: {
                  ...config.editor,
                  aliasHint: val,
                },
              });
            }}
          />
        </CardContent>
      </Card>

      <Card data-tour="export-settings">
        <CardHeader>
          <CardTitle>{t("settings.export.export")}</CardTitle>
          <CardDescription>{t("settings.export.description")}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <SettingSwitch
            label={t("settings.export.export")}
            description={t("settings.export.description")}
            value={config.export?.saveDialog ?? false}
            onChange={async (val) => {
              await patchConfig({
                export: {
                  ...config.export,
                  saveDialog: val,
                },
              });
            }}
          />

          <div className="space-y-2">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <Label>{t("settings.export.default_folder.label")}</Label>
                <p className="text-xs text-muted-foreground">
                  {t("settings.export.default_folder.description")}
                </p>
              </div>

              <button
                onClick={async () => {
                  const folder = await window.dialog.selectFolder();
                  if (folder) {
                    await patchConfig({
                      export: {
                        ...config.export,
                        saveFolder: folder,
                      },
                    });
                  }
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 dark:bg-neutral-800 text-white px-3 py-2 text-xs hover:bg-neutral-800 dark:hover:bg-neutral-700 transition"
              >
                <Folder size={14} />
                {t("settings.export.choose_folder")}
              </button>
            </div>

            <Input
              value={config.export?.saveFolder ?? ""}
              onChange={async (e) => {
                await patchConfig({
                  export: {
                    ...config.export,
                    saveFolder: e.target.value,
                  },
                });
              }}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <Label>{t("settings.export.timeout")}</Label>
                <p className="text-xs text-muted-foreground">
                  {t("settings.export.timeout_description")}
                </p>
              </div>
            </div>

            <Input
              value={config.export?.exportTimeout ?? "120000"}
              type="number"
              onChange={async (e) => {
                await patchConfig({
                  export: {
                    ...config.export,
                    exportTimeout: Number(e.target.value),
                  },
                });
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.zotero.zotero")}</CardTitle>
          <CardDescription>{t("settings.zotero.description")}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <SettingSwitch
            label={t("settings.zotero.enable.label")}
            description={t("settings.zotero.enable.description")}
            value={config.zotero?.enabled ?? false}
            onChange={async (val) => {
              await patchConfig({
                zotero: {
                  ...config.zotero,
                  enabled: val,
                },
              });
            }}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-0.5">
              <Label>{t("settings.zotero.host.label")}</Label>
              <p className="text-xs text-muted-foreground">
                {t("settings.zotero.host.description")}{" "}
              </p>
            </div>
            <Input
              value={config.zotero?.host ?? "127.0.0.1"}
              onChange={async (e) => {
                await patchConfig({
                  zotero: {
                    ...config.zotero,
                    host: e.target.value,
                  },
                });
              }}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-0.5">
              <Label>{t("settings.zotero.port.label")}</Label>
              <p className="text-xs text-muted-foreground">
                {t("settings.zotero.port.description")}{" "}
              </p>
            </div>
            <Input
              type="number"
              min={1}
              max={65535}
              value={config.zotero?.port ?? 23119}
              onChange={async (e) => {
                await patchConfig({
                  zotero: {
                    ...config.zotero,
                    port: Number(e.target.value) || 23119,
                  },
                });
              }}
            />
          </div>

          <Separator />

          <div className="rounded-3xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
            <p className="font-semibold">
              {t("settings.zotero.how_to_enable.label")}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {t("settings.zotero.how_to_enable.description")}
            </p>

            <img
              src="/enabling-zotero-apis.png"
              alt={t("settings.zotero.how_to_enable.label")}
              className="mt-4 w-full rounded-2xl border border-neutral-200 dark:border-neutral-800"
            />
          </div>
        </CardContent>
      </Card>

      <CategorySection />

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.data.title")}</CardTitle>
          <CardDescription>{t("settings.data.description")}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <DangerAction
            label={t("settings.data.clear_cache.label")}
            description={t("settings.data.clear_cache.description")}
            action={t("settings.data.clear_action")}
            onClick={async () => {
              const id = toast.loading(t("common.loading"));

              try {
                toast.loading(
                  t("settings.data.clear_cache.progress.clean_unused"),
                  {
                    id,
                  },
                );

                try {
                  for await (const ev of cleanUnusedProgress()) {
                    if (ev.type === "start") {
                      toast.loading(
                        t("settings.data.clear_cache.progress.start", {
                          chaptersCount: ev.totals.chapters,
                          imagesCount: ev.totals.images,
                        }),
                        { id },
                      );
                    } else if (ev.type === "chapter") {
                      toast.loading(
                        t("settings.data.clear_cache.progress.deleting", {
                          name: "chapters",
                          index: ev.index,
                          total: ev.total,
                        }),
                        { id },
                      );
                    } else if (ev.type === "image") {
                      toast.loading(
                        t("settings.data.clear_cache.progress.deleting", {
                          name: "images",
                          index: ev.index,
                          total: ev.total,
                        }),
                        { id },
                      );
                    } else if (ev.type === "done") {
                      const { deletedChapters, deletedImages } = ev;
                      toast.success(
                        t("settings.data.clear_cache.progress.done", {
                          deletedChapters,
                          deletedImages,
                        }),
                        { id },
                      );
                    }
                  }
                } catch (err) {
                  // fallback: show generic message
                  toast.error(t("settings.data.clear_cache.progress.failed"), {
                    id,
                  });
                }
              } catch (error) {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : t("settings.data.clear_cache.progress.failed"),
                  {
                    id,
                  },
                );
              }
            }}
          />

          <Separator />
          <DangerAction
            label={t("settings.data.unused_citations.label")}
            description={t("settings.data.unused_citations.description")}
            action={t(
              cleaning
                ? "settings.data.unused_citations.checking"
                : "settings.data.unused_citations.action",
            )}
            busy={cleaning}
            onClick={() => void deleteUnusedCitations()}
          />

          <Separator />
          <DangerAction
            label={t("settings.data.config.label")}
            description={t("settings.data.config.description")}
            action={t("settings.data.reset_action")}
            onClick={async () => {
              const id = toast.loading(t("common.loading"));

              try {
                await window.config.reset();
                toast.success(t("common.done_action"), { id });
              } catch (error) {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : t("settings.data.clear_cache.progress.failed"),
                  {
                    id,
                  },
                );
              }
            }}
          />

          <Separator />

          <DangerAction
            label={t("settings.data.clear_data.label")}
            description={t("settings.data.clear_data.description")}
            action="Clear"
            onClick={async () => {
              const confirmed = confirm(t("settings.data.clear_data.confirm"));

              if (!confirmed) return;

              const id = toast.loading(
                t("settings.data.clear_data.deleting.start"),
              );

              try {
                const docs = await HighTexDB.getMainDocuments();

                let deleted = 0;

                for (const doc of docs) {
                  toast.loading(
                    t("settings.data.clear_data.deleting.progress", {
                      deleted: deleted + 1,
                      total: docs.length,
                      identifier: doc.title || doc.id,
                    }),
                    { id },
                  );

                  await HighTexDB.getInstance().deleteDocument(doc.id);

                  deleted++;
                }

                toast.success(
                  t("settings.data.clear_data.deleting.done", {
                    total: deleted,
                  }),
                  {
                    id,
                  },
                );
              } catch (error) {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : "Failed to delete documents",
                  { id },
                );
              }
            }}
          />
        </CardContent>
      </Card>
    </>
  );
};
export const SettingSwitch = ({
  label,
  description,
  value = false,
  onChange,
}: {
  label: string | React.ReactNode;
  description?: string;
  value?: boolean;
  onChange?: (val: boolean) => void;
}) => {
  return (
    <div className="flex items-center justify-between">
      <div className="space-y-0.5">
        <Label>{label}</Label>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>

      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );
};
const DangerAction = ({
  label,
  description,
  action,
  onClick,
  busy = false,
}: {
  label: string;
  description?: string;
  action: string;
  onClick?: () => void;
  busy?: boolean;
}) => {
  return (
    <div className="flex items-center justify-between">
      <div className="space-y-0.5">
        <Label>{label}</Label>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>

      <Button
        variant="destructive"
        size="sm"
        onClick={onClick}
        disabled={busy}
        aria-busy={busy}
      >
        {busy && <Loader2 className="animate-spin" />}
        {action}
      </Button>
    </div>
  );
};

const AppInfoSection = () => {
  const [licenseOpen, setLicenseOpen] = useState(false);
  const [version, setVersion] = useState<string | null>(null);
  const [status, setStatus] = useState<UpdaterStatus | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    window.hightex.version().then(setVersion);

    const unsubscribe = window.updater?.onStatus((s) => {
      setStatus(s);

      if (s.status !== "checking" && s.status !== "downloading") {
        setChecking(false);
      }
    });

    return () => unsubscribe?.();
  }, []);

  const handleCheck = async () => {
    setChecking(true);
    await window.updater?.check();
  };

  const handleDownload = async () => {
    await window.updater?.download();
  };

  const handleInstall = async () => {
    const result = await window.updater?.install();
    if (result && !result.ok && !result.cancelled)
      toast.error(result.message || t("settings.updater.install_failed"));
  };

  const renderUpdateStatus = () => {
    if (!status) return null;

    switch (status.status) {
      case "checking":
        return (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 size={12} className="animate-spin" />
            {t("settings.updater.checking")}
          </div>
        );

      case "not-available":
        return (
          <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
            <CheckCircle size={12} />
            {t("settings.updater.up_to_date")}
          </div>
        );

      case "available":
        return (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
              <Download size={12} />
              {t("settings.updater.available", {
                version: status.info.version,
              })}
            </div>

            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={handleDownload}
            >
              {t("settings.updater.download")}
            </Button>
          </div>
        );

      case "downloading":
        return (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 size={12} className="animate-spin" />
            {t("settings.updater.downloading", {
              percent: Math.round(status.progress.percent),
            })}
          </div>
        );

      case "downloaded":
        return (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
              <CheckCircle size={12} />
              {t("settings.updater.ready", {
                version: status.info.version,
              })}
            </div>

            <Button size="sm" className="h-7 text-xs" onClick={handleInstall}>
              {t("settings.updater.restart_install")}
            </Button>
          </div>
        );

      case "installing":
        return (
          <p
            role="status"
            className="flex items-center gap-2 text-xs text-muted-foreground"
          >
            <Loader2 size={12} className="animate-spin" />
            {t("settings.updater.installing")}
          </p>
        );

      case "error":
        return (
          <div className="flex items-center gap-2 text-xs text-destructive">
            <AlertCircle size={12} />
            {status.message}
          </div>
        );

      case "disabled":
        return (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <AlertCircle size={12} />
            {status.reason}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.about.title")}</CardTitle>
        <CardDescription>{t("settings.about.header")}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>{t("settings.about.version.label")}</Label>

            <p className="text-xs text-muted-foreground">
              {t("settings.about.version.description")}
            </p>
          </div>

          <span className="font-mono text-sm text-foreground">
            {version ?? "—"}
          </span>
        </div>

        <div className="flex items-center justify-between gap-4 text-sm">
          <Label>{t("settings.about.creator")}</Label>
          <span>Jepi Okta Mipa</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <Label>{t("settings.about.license")}</Label>
          <Button
            data-license-open
            variant="outline"
            size="sm"
            onClick={() => setLicenseOpen(true)}
          >
            GPL-3.0-only
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          © 2026 Jepi Okta Mipa {t("settings.about.contributors")}
        </p>
        <Dialog open={licenseOpen} onOpenChange={setLicenseOpen}>
          <DialogContent
            className="flex max-h-[85dvh] flex-col sm:max-w-2xl"
            data-license-dialog
          >
            <DialogHeader>
              <DialogTitle>{t("settings.about.license")}</DialogTitle>
              <DialogDescription>
                {t("settings.about.license_description")}
              </DialogDescription>
            </DialogHeader>
            <pre
              data-license-text
              tabIndex={0}
              aria-label={t("settings.about.license")}
              className="has-scrollbar min-h-0 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border bg-muted/30 p-4 text-xs leading-relaxed"
            >
              {copyrightNotice + "\n" + licenseText}
            </pre>
            <DialogFooter className="m-0 shrink-0 border-0 bg-transparent p-0">
              <Button
                data-license-source
                variant="outline"
                onClick={() =>
                  executeInteractively(() =>
                    window.file.openExternal(
                      "https://github.com/jefyokta/hightex-desktop",
                    ),
                  )
                }
              >
                {t("settings.about.source")}
              </Button>
              <Button onClick={() => setLicenseOpen(false)}>
                {t("common.close")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Separator />

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>{t("settings.updater.label")}</Label>

            <div className="mt-1">{renderUpdateStatus()}</div>
          </div>

          <Button
            variant="outline"
            size="sm"
            disabled={
              checking ||
              status?.status === "checking" ||
              status?.status === "downloading" ||
              status?.status === "downloaded" ||
              status?.status === "installing"
            }
            onClick={handleCheck}
            className="gap-2"
          >
            <RefreshCw
              size={13}
              className={
                checking || status?.status === "checking" ? "animate-spin" : ""
              }
            />

            {t("settings.updater.check")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const CategorySection = () => {
  const [updating, setUpdating] = useState(false);
  const [result, setResult] = useState<"success" | "failed" | null>(null);
  const refresh = async () => {
    if (updating) return;
    setUpdating(true);
    setResult(null);
    try {
      await window.hightex.refreshCategories();
      setResult("success");
    } catch {
      setResult("failed");
    } finally {
      setUpdating(false);
    }
  };
  return (
    <Card data-tour="category-settings">
      <CardHeader>
        <CardTitle>{t("settings.categories.title")}</CardTitle>
        <CardDescription>
          {t("settings.categories.description")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          variant="outline"
          onClick={() => void refresh()}
          disabled={updating}
          aria-busy={updating}
        >
          <RefreshCw className={updating ? "animate-spin" : ""} />
          {t(
            updating
              ? "settings.categories.updating"
              : "settings.categories.update",
          )}
        </Button>
        {result && (
          <p
            role={result === "failed" ? "alert" : "status"}
            className="text-sm text-muted-foreground"
          >
            {t(
              result === "failed"
                ? "settings.categories.failed"
                : "settings.categories.success",
            )}
          </p>
        )}
      </CardContent>
    </Card>
  );
};
