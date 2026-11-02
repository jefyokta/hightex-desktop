import { Cloud, ArrowLeft, LogIn } from "lucide-react";
import { Link } from "react-router-dom";
import { Button, buttonVariants } from "./ui/button";
import { useOnline } from "@/hooks/use-online";
import { useAuthModal } from "@/context/auth-modal-context";
import { t, useAppLanguage } from "@/utils/lang";

export const LoginGate = ({ compact = false }: { compact?: boolean }) => {
  useAppLanguage();
  const online = useOnline();
  const { openLogin } = useAuthModal();
  return (
    <section
      className={`mx-auto flex max-w-xl flex-col items-center justify-center px-5 text-center ${compact ? "py-5" : "min-h-[55vh] py-12"}`}
    >
      <span className="workspace-brand-icon flex size-16 items-center justify-center rounded-2xl">
        <Cloud className="size-7" />
      </span>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">
        {t(compact ? "workspace.account" : "workspace.cloud_title")}
      </h1>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
        {t(compact ? "workspace.account_login_hint" : "workspace.cloud_hint")}
      </p>
      <Button
        className="workspace-primary mt-6"
        onClick={openLogin}
        disabled={!online}
      >
        <LogIn />
        {t("common.login")}
      </Button>
      {!online && (
        <p role="status" className="mt-3 text-xs text-muted-foreground">
          {t("workspace.offline_login")}
        </p>
      )}
      {!compact && (
        <Link
          to="/dashboard"
          className={buttonVariants({
            variant: "ghost",
            className: "mt-3 text-muted-foreground",
          })}
        >
          <ArrowLeft />
          {t("workspace.back_documents")}
        </Link>
      )}
    </section>
  );
};
