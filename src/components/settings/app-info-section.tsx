import { useIPC } from "@/hooks/use-ipc";
import { useEffect, useState } from "react";
import licenseText from "../../../LICENSE?raw";
import copyrightNotice from "../../../COPYRIGHT?raw";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { executeInteractively } from "@/utils/execute-interactively";
import { t } from "@/utils/lang";
import { UpdaterSettings } from "./updater-settings";

export function AppInfoSection() {
  const [licenseOpen, setLicenseOpen] = useState(false);
  const [version, setVersion] = useState<string | null>(null);
  useEffect(() => { void useIPC("hightex").hightex.version().then(setVersion); }, []);

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
                    useIPC("file").file.openExternal(
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

        <UpdaterSettings />
      </CardContent>
    </Card>
  );
}
