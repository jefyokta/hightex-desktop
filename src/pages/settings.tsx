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

import { Folder, InfoIcon, Monitor, Moon, Sun } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipTrigger,
  TooltipPanel,
} from "@/components/animate-ui/components/base/tooltip";
import { toast } from "sonner";
import { cleanUnused } from "@/utils/clean-unused-data";
import { HighTexDB } from "@/editor/storage/hightex-db";

export const Settings = () => {
  const [config, setConfig] = useState<ConfigShape | null>(null);

  const [theme, setTheme] = useState<ThemeMode>("system");

  useEffect(() => {
    const init = window.config.get();

    if (init) {
      setConfig(init);
      setTheme(init.theme);
    }

    return window.config.onChange((cnfg) => {
      setConfig(cnfg);
      setTheme(cnfg.theme);
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

  if (!config) return null;

  return (
    <div className="flex-1 p-6 max-w-3xl mx-auto overflow-auto relative w-full space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your application preferences
        </p>
      </div>
      <ProfileSection />
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Theme and visual preferences</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Theme</Label>
              <p className="text-xs text-muted-foreground">
                Choose application theme mode
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
                    Light
                  </div>
                </SelectItem>

                <SelectItem value="dark">
                  <div className="flex items-center gap-2">
                    <Moon size={14} />
                    Dark
                  </div>
                </SelectItem>

                <SelectItem value="system">
                  <div className="flex items-center gap-2">
                    <Monitor size={14} />
                    System
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Editor</CardTitle>
          <CardDescription>Writing and editing behavior</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <SettingSwitch
            label="Spell Check"
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
            label={
              <>
                <span>Prefer Cloud Profile</span>{" "}
                <Tooltip>
                  <TooltipTrigger>
                    <InfoIcon size={12} />
                  </TooltipTrigger>
                  <TooltipPanel>
                    If you enable this, when you connected to the cloud profile,
                    the all documents will using cloud profile
                  </TooltipPanel>
                </Tooltip>
              </>
            }
            description="Use cloud profile as primary identity"
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Export</CardTitle>
          <CardDescription>Configure how exports are saved</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <SettingSwitch
            label="Enable save dialog"
            description="Show a save dialog when exporting a HighTex package"
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
                <Label>Default export folder</Label>
                <p className="text-xs text-muted-foreground">
                  Files are saved here automatically when the save dialog is
                  disabled.
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
                Choose Folder
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Zotero</CardTitle>
          <CardDescription>
            Connect to your local Zotero client for direct reference import.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <SettingSwitch
            label="Enable local Zotero"
            description="Allow HighTex to connect to Zotero on the configured host and port."
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
              <Label>Host</Label>
              <p className="text-xs text-muted-foreground">
                The network host where the Zotero local server is exposed.
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
              <Label>Port</Label>
              <p className="text-xs text-muted-foreground">
                The port used by Zotero's local API. The default value is 23119.
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
            <p className="font-semibold">How to enable Zotero HTTP access</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Open Zotero preferences, go to Advanced &gt; General, and enable
              "Enable HTTP access". Restart Zotero to apply the setting.
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
            label="Clear Cache"
            description="Remove temporary stored data"
            action="Clear"
            onClick={async () => {
              const id = toast.loading("Resetting config...");

              try {
                await window.config.reset();

                toast.loading("Cleaning unused data...", {
                  id,
                });

                const result = await cleanUnused();

                toast.success(
                  result.deleted
                    ? `Cleanup completed. ${result.deleted} unused chapters deleted`
                    : "Cleanup completed. No unused chapters found",
                  {
                    id,
                  },
                );
              } catch (error) {
                toast.error(
                  error instanceof Error ? error.message : "Cleanup failed",
                  {
                    id,
                  },
                );
              }
            }}
          />

          <Separator />

          <DangerAction
            label="Clear Data"
            description="Delete all of your documents"
            action="Clear"
            onClick={async () => {
              const confirmed = confirm(
                "Are you sure you want to delete all documents?",
              );

              if (!confirmed) return;

              const id = toast.loading("Deleting documents...");

              try {
                const docs = await HighTexDB.getDocuments();

                let deleted = 0;

                for (const doc of docs) {
                  toast.loading(
                    `Deleting ${deleted + 1}/${docs.length}: ${doc.title || doc.id}`,
                    { id },
                  );

                  await HighTexDB.getInstance().deleteDocument(doc.id);

                  deleted++;
                }

                toast.success(`${deleted} documents deleted successfully`, {
                  id,
                });
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
    </div>
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
  const [profile, setProfile] = useState<Profile>({
    name: "",
    nim: "",
    advisorName: "",
    advisorNip: "",
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
    } catch (err) {
      console.error("Failed to save profile:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription className="space-x-2 flex items-center">
          <span>Configure your local profile here</span>
          <Tooltip>
            <TooltipTrigger>
              <InfoIcon size={12} />
            </TooltipTrigger>
            <TooltipPanel>
              Fallback profile when internet gone away
            </TooltipPanel>
          </Tooltip>
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading profile...</p>
        ) : (
          <>
            <div className="grid w-full grid-cols-2 items-center gap-4">
              <div className="space-y-0.5">
                <Label>Name</Label>
                <p className="text-xs text-muted-foreground">
                  Your name to be the author of your documents
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
                <Label>Nim</Label>
                <p className="text-xs text-muted-foreground">
                  Your student identifier number
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
                <Label>Advisor Name</Label>
                <p className="text-xs text-muted-foreground">
                  Your advisor's name
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
                <Label>Advisor's NIP</Label>
                <p className="text-xs text-muted-foreground">
                  Your advisor's identifier number
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

            <div className="flex justify-end pt-4">
              <Button onClick={saveProfile} disabled={saving}>
                {saving ? "Saving..." : "Save Profile"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
