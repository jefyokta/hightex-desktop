import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  FileDown,
  FileText,
  Loader2,
  LogOut,
  Quote,
} from "lucide-react";
import { motion, MotionConfig, useReducedMotion } from "motion/react";
import { toast } from "sonner";
import { useUser } from "@/hooks/use-user";
import { useOnline } from "@/hooks/use-online";
import { useSplashStartup } from "@/hooks/use-splash-startup";
import { Button } from "@/components/ui/button";
import { LayoutTextFlip } from "@/components/ui/layout-text-flip";
import { ContributorsDialog } from "@/components/splash/contributors-dialog";
import { SplashDocumentPreview } from "@/components/splash/document-preview";
import { GitHubSupport } from "@/components/splash/github-support";
import { t, useAppLanguage } from "@/utils/lang";
import HighTexLogo from "@/assets/icons/hightex";
import "@/css/splash.css";

const thanks = [
  { name: "Tengku Khairil Ahsyar", role: "Lovely Mentor" },
  { name: "Bintang Aditiya", role: "The First User" },
  { name: "Rafiki Syahputra", role: "Testing Partner" },
  { name: "Irvandi Kurniawan", role: "Best of The Best Friend" },
];

export const Splash = () => {
  useAppLanguage();
  const navigate = useNavigate();
  const { user } = useUser();
  const online = useOnline();
  const { phase, progress, version } = useSplashStartup(online);
  const reducedMotion = useReducedMotion();
  const [loggingOut, setLoggingOut] = useState(false);
  const preparing = phase === "preparing";

  const logout = async () => {
    setLoggingOut(true);
    try {
      const result = await window.session.logout();
      if (!result.revoked) toast.warning(t("desktop_auth.logout_unconfirmed"));
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="splash-screen relative isolate flex min-h-dvh flex-col overflow-hidden bg-background text-foreground">
        <div
          className="drag-bar absolute inset-x-0 top-0 z-10 h-7"
          aria-hidden="true"
        />
        <div className="splash-ambient" aria-hidden="true" />
        <header className="relative mx-auto flex w-full max-w-6xl items-center justify-between px-6 pb-4 pt-10 sm:px-10 lg:px-12">
          <div className="flex items-center gap-3">
            <HighTexLogo
              size={44}
              replayOnClick={false}
              className="shrink-0 rounded-xl"
            />
            <div>
              <div className="text-base font-semibold tracking-tight">
                HighTex<span className="splash-brand-text">.</span>
              </div>
              <div className="mt-0.5 text-[10px] tracking-wide text-muted-foreground">
                {t("splash.workspace")}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-2">
              <span
                className={
                  online
                    ? "splash-online-dot"
                    : "size-1.5 rounded-full bg-muted-foreground/50"
                }
                aria-hidden="true"
              />
              {online ? t("splash.online") : t("splash.offline")}
            </span>
            {version && (
              <span className="border-l pl-4 font-mono text-[11px]">
                v{version}
              </span>
            )}
          </div>
        </header>

        <main className="relative mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-6 py-12 sm:px-10 lg:grid-cols-2 lg:gap-12 lg:px-12 lg:py-6">
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mx-auto w-full max-w-xl lg:mx-0"
          >
            <div className="mb-6 flex items-center gap-2.5 text-[11px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
              <span className="splash-brand-rule" aria-hidden="true" />
              {t("splash.eyebrow")}
            </div>
            <h1 className="text-[clamp(2.65rem,4.6vw,4rem)] leading-[1.08] font-semibold tracking-[-0.055em]">
              {t("splash.headline")}
              <br />
              <span className="text-muted-foreground">
                {t("splash.headline_end")}
              </span>
            </h1>
            <p className="mt-6 max-w-[24rem] text-sm leading-7 text-muted-foreground sm:text-[15px]">
              {t("splash.description")}
            </p>

            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-2">
                <FileText className="size-3.5" aria-hidden="true" />
                {t("splash.feature_writing")}
              </span>
              <span className="flex items-center gap-2">
                <Quote className="size-3.5" aria-hidden="true" />
                {t("splash.feature_citations")}
              </span>
              <span className="flex items-center gap-2">
                <FileDown className="size-3.5" aria-hidden="true" />
                {t("splash.feature_pdf")}
              </span>
            </div>

            <div className="mt-10 max-w-sm">
              <p className="mb-3 text-xs text-muted-foreground">
                {user
                  ? t("splash.welcome_back", { name: user.name.split(" ")[0] })
                  : t("splash.no_account")}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  className="h-11 gap-8 rounded-xl px-5"
                  disabled={preparing}
                  aria-busy={preparing}
                  onClick={() => navigate("/dashboard")}
                >
                  {preparing
                    ? t("splash.preparing")
                    : t("splash.start_writing")}
                  {preparing ? (
                    <Loader2
                      className="size-4 animate-spin motion-reduce:animate-none"
                      aria-hidden="true"
                    />
                  ) : (
                    <ArrowRight className="size-4" aria-hidden="true" />
                  )}
                </Button>
                {user && (
                  <Button
                    variant="ghost"
                    className="h-11 gap-2 rounded-xl px-4 text-muted-foreground"
                    disabled={preparing || loggingOut}
                    onClick={() => void logout()}
                  >
                    <LogOut className="size-3.5" aria-hidden="true" />
                    {t("common.logout")}
                  </Button>
                )}
              </div>
              <div className="mt-4 min-h-9" role="status" aria-live="polite">
                {preparing ? (
                  <div className="max-w-[260px] space-y-2">
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>{t("splash.getting_ready")}</span>
                      <span className="font-mono tabular-nums">
                        {Math.round(progress)}%
                      </span>
                    </div>
                    <div
                      role="progressbar"
                      aria-label={t("splash.preparing")}
                      aria-valuenow={Math.round(progress)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      className="h-1 overflow-hidden rounded-full bg-muted"
                    >
                      <div
                        className="splash-progress-fill h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="splash-online-dot" aria-hidden="true" />
                    {phase === "local"
                      ? t("splash.local_ready")
                      : t("splash.ready")}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.1 }}
            className="hidden min-w-0 lg:block"
          >
            <SplashDocumentPreview />
          </motion.div>
        </main>

        <footer className="relative mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 pb-6 sm:px-10 lg:px-12">
          <div className="flex flex-col gap-4 border-t pt-5 sm:flex-row sm:items-center sm:gap-6">
            <GitHubSupport />
            <ContributorsDialog />
          </div>
          <div className="min-h-8 pb-1">
            {reducedMotion ? (
              <p className="text-xs text-muted-foreground">
                {t("splash.thanks_to")}{" "}
                {thanks.map((person) => person.name).join(" · ")}
              </p>
            ) : (
              <LayoutTextFlip
                text={t("splash.thanks_to")}
                words={thanks}
                duration={4500}
              />
            )}
          </div>
        </footer>
      </div>
    </MotionConfig>
  );
};
