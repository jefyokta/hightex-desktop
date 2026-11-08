import { useCallback, useEffect, useRef, useState } from "react";
import { CloudDownload, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuthModal } from "@/context/auth-modal-context";
import { useUser } from "@/hooks/use-user";
import { useOnline } from "@/hooks/use-online";
import { useWorkspaces } from "@/hooks/use-workspaces";
import { fetchCloudLecturers } from "@/hooks/use-lecturer-directory";
import { t } from "@/utils/lang";
import { Button } from "./ui/button";

export function LecturerCloudButton({ disabled }: { disabled: boolean }) {
  const { state, error } = useWorkspaces();
  const active = state?.profiles.find(
    (profile) => profile.id === state.activeId,
  );
  if (!active)
    return (
      <p role="status" className="text-xs text-muted-foreground">
        {error || t("common.loading")}
      </p>
    );
  return active.type === "local" ? (
    <LecturerWebDownload />
  ) : (
    <AuthenticatedLecturerCloudButton disabled={disabled} />
  );
}

function LecturerWebDownload() {
  const online = useOnline();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <div
      className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-4"
      data-lecturer-web-download
    >
      <Button
        type="button"
        variant="ghost"
        disabled={!online || busy}
        onClick={() => {
          setBusy(true);
          setFailed(false);
          void window.hightex.lecturers
            .openWebDownload()
            .catch(() => setFailed(true))
            .finally(() => setBusy(false));
        }}
      >
        {busy ? <Loader2 className="animate-spin" /> : <ExternalLink />}
        {t("lecturers.web_download")}
      </Button>
      <p
        className="max-w-xl text-xs leading-relaxed text-muted-foreground"
        role={failed ? "alert" : "status"}
      >
        {t(
          failed
            ? "lecturers.web_open_failed"
            : !online
              ? "lecturers.web_offline"
              : "lecturers.local_web_hint",
        )}
      </p>
    </div>
  );
}

function AuthenticatedLecturerCloudButton({ disabled }: { disabled: boolean }) {
  const { user } = useUser();
  const { loginOpen, openLogin } = useAuthModal();
  const online = useOnline();
  const [busy, setBusy] = useState(false);
  const [loginPending, setLoginPending] = useState(false);
  const [error, setError] = useState<LecturerCloudError>();
  const beforeLogin = useRef<User | false>(false);
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const download = useCallback(async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(undefined);
    const result = await fetchCloudLecturers();
    pending.current = false;
    if (!mounted.current) return;
    setBusy(false);
    if (result.ok) {
      toast.success(
        t("lecturers.cloud_success", {
          added: result.result.added,
          skipped: result.result.skipped,
        }),
      );
    } else setError(result.error);
  }, []);

  // Only resume an explicit login-and-download intent after a new authenticated user event.
  // Closing/cancelling login cannot trigger a download with a stale cached user.
  useEffect(() => {
    if (!loginPending) return;
    if (user && user !== beforeLogin.current) {
      setLoginPending(false);
      void download();
    } else if (!loginOpen) setLoginPending(false);
  }, [user, loginOpen, loginPending, download]);

  const needsLogin = !user || error === "not_authenticated";
  return (
    <div
      className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-4"
      data-lecturer-cloud
    >
      <Button
        type="button"
        variant="ghost"
        className="shrink-0"
        disabled={disabled || busy || !online || loginPending}
        onClick={() => {
          if (needsLogin) {
            beforeLogin.current = user;
            setLoginPending(true);
            openLogin();
          } else void download();
        }}
      >
        {busy ? <Loader2 className="animate-spin" /> : <CloudDownload />}
        {t(
          busy
            ? "lecturers.cloud_loading"
            : needsLogin
              ? "lecturers.cloud_login"
              : "lecturers.cloud_fetch",
        )}
      </Button>
      <p
        className="max-w-xl text-xs leading-relaxed text-muted-foreground"
        role={error ? "alert" : "status"}
      >
        {error
          ? t(`lecturers.cloud_errors.${error}`)
          : !online
            ? t("lecturers.cloud_offline")
            : t(
                needsLogin
                  ? "lecturers.cloud_login_hint"
                  : "lecturers.cloud_hint",
              )}
      </p>
    </div>
  );
}
