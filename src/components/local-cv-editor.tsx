import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { ProfileCVPage } from "./profile-cv-page";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { sanitizeCvHtml } from "@/utils/sanitize-cv-html";
import { toWebPBlob } from "@/utils/images-to-webp";
import { executeInteractively } from "@/utils/execute-interactively";
import { t } from "@/utils/lang";

export function LocalCVEditor({
  onDirtyChange,
  onBusyChange,
}: {
  onDirtyChange(dirty: boolean): void;
  onBusyChange(busy: boolean): void;
}) {
  const [cv, setCv] = useState("");
  const [original, setOriginal] = useState("");
  const [picture, setPicture] = useState<Blob>();
  const [pictureChanged, setPictureChanged] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const dirty = !loading && !failed && (cv !== original || pictureChanged);
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  useEffect(() => onBusyChange(busy), [busy, onBusyChange]);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setFailed(false);
    void Promise.all([window.profile.get(), window.profile.picture()])
      .then(([profile, bytes]) => {
        if (!alive) return;
        const html = sanitizeCvHtml(profile.cv);
        setCv(html);
        setOriginal(html);
        setPictureChanged(false);
        setPicture(
          bytes
            ? new Blob([bytes.slice().buffer], { type: "image/webp" })
            : undefined,
        );
      })
      .catch(() => {
        if (alive) setFailed(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [revision]);
  const save = async () => {
    setBusy(true);
    try {
      await window.profile.set({ cv: sanitizeCvHtml(cv) });
      if (pictureChanged)
        await window.profile.setPicture(
          picture ? new Uint8Array(await picture.arrayBuffer()) : null,
        );
      setOriginal(cv);
      setPictureChanged(false);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5">
          <CardTitle>{t("document_profile.cv_title")}</CardTitle>
          <CardDescription id="workspace-cv-hint">
            {t("document_profile.cv_description")} {t("cloud_cv.hint")}
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          {picture && (
            <Button
              variant="ghost"
              disabled={busy || loading || failed}
              onClick={() => {
                setPicture(undefined);
                setPictureChanged(true);
              }}
            >
              {t("document_profile.remove_picture")}
            </Button>
          )}
          <Button
            data-tour="workspace-cv-save"
            disabled={!dirty || busy}
            onClick={() =>
              void executeInteractively(save, {
                successMessage: t("profile.cv_saved"),
              })
            }
          >
            <Save className="size-4" />
            {t(busy ? "settings.profile.saving" : "account_profile.save")}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p role="status">{t("settings.profile.loading")}</p>
        ) : failed ? (
          <div className="space-y-3">
            <p role="alert">{t("onboarding.profile.load_failed")}</p>
            <Button
              variant="outline"
              onClick={() => setRevision((value) => value + 1)}
            >
              {t("dashboard.retry")}
            </Button>
          </div>
        ) : (
          <ProfileCVPage
            id="workspace-cv"
            value={cv}
            picture={picture}
            editable={!busy}
            busy={busy}
            describedBy="workspace-cv-hint"
            onChange={setCv}
            onPictureChange={(file) => {
              setBusy(true);
              void toWebPBlob(file)
                .then((blob) => {
                  setPicture(blob);
                  setPictureChanged(true);
                })
                .catch(() => toast.error(t("settings.profile.picture_invalid")))
                .finally(() => setBusy(false));
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}
