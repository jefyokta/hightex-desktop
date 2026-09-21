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
  InfoIcon,
  Loader2,
  Monitor,
  Moon,
  RefreshCw,
  Sun,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipTrigger,
  TooltipPanel,
} from "@/components/animate-ui/components/base/tooltip";
import { toast } from "sonner";
import { cleanUnusedProgress } from "@/utils/clean-unused-data";
import { HighTexDB } from "@/editor/storage/hightex-db";
import { LANGUAGE_OPTIONS, t, type SupportedLanguage } from "@/utils/lang";
import { executeInteractively } from "@/utils/execute-interactively";

export const Settings = () => {
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
      <div>
        <h1 className="text-xl font-semibold text-foreground">
          {t("settings.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("settings.subtitle")}
        </p>
      </div>
      <AppInfoSection />
      <ProfileSection />
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
            label={
              <>
                <span>{t("settings.profile.cloud_profile")}</span>{" "}
                <Tooltip>
                  <TooltipTrigger>
                    <InfoIcon size={12} />
                  </TooltipTrigger>
                  <TooltipPanel>
                    {t("settings.profile.cloud_tooltip")}
                  </TooltipPanel>
                </Tooltip>
              </>
            }
            description={t("settings.profile.cloud_profile_description")}
            value={config.editor?.preferCloudProfile ?? false}
            onChange={async (val) => {
              await patchConfig({
                editor: {
                  ...config.editor,
                  preferCloudProfile: val,
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
                <span>Enable Alias Hints</span>

              </>
            }
            description={"Show the meaning of words defined in your Aliases List when you hover over them in the editor."}
            value={config.editor?.aliasHint ?? false}
            onChange={async (val) => {
              await patchConfig({
                editor: {
                  ...config.editor,
                  aliasHint: val

                },
              });
            }}
          />
        </CardContent>
      </Card>

      <Card>
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
                <Label>Export timeout</Label>
                <p className="text-xs text-muted-foreground">
                  {"Export timeout in millisecond, default 120000ms (120 seconds)"}
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
                    exportTimeout: Number(e.target.value)
                  },
                });
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Zotero</CardTitle>
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
              alt="Enable Zotero HTTP access"
              className="mt-4 w-full rounded-2xl border border-neutral-200 dark:border-neutral-800"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data</CardTitle>
          <CardDescription>Storage and reset options</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <DangerAction
            label={t("settings.data.clear_cache.label")}
            description={t("settings.data.clear_cache.description")}
            action="Clear"
            onClick={async () => {
              const id = toast.loading("Loading...");

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
            label={t("settings.data.config.label")}
            description={t("settings.data.config.description")}
            action="Reset"
            onClick={async () => {
              const id = toast.loading("Loading...");

              try {
                await window.config.reset();
                toast.success("Done", { id });
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
                const docs = await HighTexDB.getDocuments();

                let deleted = 0;

                for (const doc of docs) {
                  toast.loading(
                    t("settings.data.clear_data.deleting.start", {
                      deleted: deleted + 1,
                      total: docs.length,
                      identifier: doc.title || doc.id,
                    }),
                    // `Deleting ${deleted + 1}/${docs.length}: ${doc.title || doc.id}`,
                    { id },
                  );

                  await HighTexDB.getInstance().deleteDocument(doc.id);

                  deleted++;
                }

                toast.success(
                  t("settings.data.clear_data.deleting.done", { deleted }),
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
const SettingSwitch = ({
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
}: {
  label: string;
  description?: string;
  action: string;
  onClick?: () => void;
}) => {
  return (
    <div className="flex items-center justify-between">
      <div className="space-y-0.5">
        <Label>{label}</Label>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>

      <Button variant="destructive" size="sm" onClick={onClick}>
        {action}
      </Button>
    </div>
  );
};

const ProfileSection = () => {
  const [profile, setProfile] = useState<Omit<Profile, "cv">>({
    name: "",
    nim: "",
    advisorName: "",
    advisorNip: "",
    secondAdvisor: undefined,
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);

      try {
        const prof = await window.profile.get();

        if (!mounted) return;

        setProfile({
          name: prof?.name ?? "",
          nim: prof?.nim ?? "",
          advisorName: prof?.advisorName ?? "",
          advisorNip: prof?.advisorNip ?? "",
          secondAdvisor: prof.secondAdvisor,

        });
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const saveProfile = async () => {
    try {
      setSaving(true);
      await window.profile.set(profile);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.profile.label")}</CardTitle>

        <CardDescription className="flex items-center space-x-2">
          <span>{t("settings.profile.description")}</span>

          <Tooltip>
            <TooltipTrigger>
              <InfoIcon size={12} />
            </TooltipTrigger>

            <TooltipPanel>{t("settings.profile.tooltip")}</TooltipPanel>
          </Tooltip>
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {loading ? (
          <p className="text-sm text-muted-foreground">
            {t("settings.profile.loading")}
          </p>
        ) : (
          <>
            <div className="grid w-full grid-cols-2 items-center gap-4">
              <div className="space-y-0.5">
                <Label>{t("settings.profile.name.label")}</Label>
                <p className="text-xs text-muted-foreground">
                  {t("settings.profile.name.description")}
                </p>
              </div>

              <Input
                value={profile.name}
                onChange={(e) =>
                  setProfile((prev) => ({
                    ...prev,
                    name: e.target.value,
                  }))
                }
              />
            </div>

            <div className="grid w-full grid-cols-2 items-center gap-4">
              <div className="space-y-0.5">
                <Label>{t("settings.profile.nim.label")}</Label>
                <p className="text-xs text-muted-foreground">
                  {t("settings.profile.nim.description")}
                </p>
              </div>

              <Input
                value={profile.nim}
                onChange={(e) =>
                  setProfile((prev) => ({
                    ...prev,
                    nim: e.target.value,
                  }))
                }
              />
            </div>

            <div className="grid w-full grid-cols-2 items-center gap-4">
              <div className="space-y-0.5">
                <Label>{t("settings.profile.advisor.name.label")}</Label>
                <p className="text-xs text-muted-foreground">
                  {t("settings.profile.advisor.name.description")}
                </p>
              </div>

              <Input
                value={profile.advisorName}
                onChange={(e) =>
                  setProfile((prev) => ({
                    ...prev,
                    advisorName: e.target.value,
                  }))
                }
              />
            </div>

            <div className="grid w-full grid-cols-2 items-center gap-4">
              <div className="space-y-0.5">
                <Label>{t("settings.profile.advisor.nip.label")}</Label>
                <p className="text-xs text-muted-foreground">
                  {t("settings.profile.advisor.nip.description")}
                </p>
              </div>

              <Input
                value={profile.advisorNip}
                onChange={(e) =>
                  setProfile((prev) => ({
                    ...prev,
                    advisorNip: e.target.value,
                  }))
                }
              />
            </div>
            <div className="grid w-full  items-center gap-4">
              <SettingSwitch
                onChange={(e) => {
                  if (e) {
                    setProfile((prev) => ({
                      ...prev,
                      secondAdvisor: { name: "", nip: "" },
                    }));
                    return;
                  }
                  setProfile((prev) => ({ ...prev, secondAdvisor: undefined }));
                }}
                value={typeof profile.secondAdvisor !== "undefined"}
                description={t(
                  "settings.profile.second_advisor.enable_description",
                )}
                label={t("settings.profile.second_advisor.enable_label")}
              />
            </div>
            {typeof profile.secondAdvisor !== "undefined" && (
              <>
                <div className="grid w-full grid-cols-2 items-center gap-4">
                  <div className="space-y-0.5">
                    <Label>
                      {t("settings.profile.second_advisor.name.label")}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {t("settings.profile.second_advisor.name.description")}
                    </p>
                  </div>

                  <Input
                    value={profile.secondAdvisor.name}
                    onChange={(e) =>
                      setProfile((prev) => ({
                        ...prev,
                        secondAdvisor: {
                          nip: prev.secondAdvisor?.nip || "",
                          name: e.target.value,
                        },
                      }))
                    }
                  />
                </div>

                <div className="grid w-full grid-cols-2 items-center gap-4">
                  <div className="space-y-0.5">
                    <Label>
                      {t("settings.profile.second_advisor.nip.label")}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {t("settings.profile.second_advisor.nip.description")}
                    </p>
                  </div>

                  <Input
                    value={profile.secondAdvisor.nip}
                    onChange={(e) =>
                      setProfile((prev) => ({
                        ...prev,
                        secondAdvisor: {
                          name: prev.secondAdvisor?.name || "",
                          nip: e.target.value,
                        },
                      }))
                    }
                  />
                </div>
              </>
            )}
            <div className="flex justify-end pt-4">
              <Button onClick={() => executeInteractively(saveProfile, { successMessage: "Saved" })} disabled={saving}>
                {saving
                  ? t("settings.profile.saving")
                  : t("settings.profile.save")}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
const AppInfoSection = () => {
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
    await window.updater?.install();
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
              status?.status === "downloaded"
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
