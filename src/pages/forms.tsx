import { FileStack, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { t, useAppLanguage } from "@/utils/lang";
import { PageHeader } from "@/components/dashboard/page-header";
import { buttonVariants } from "@/components/ui/button";

export const Forms = () => {
  useAppLanguage();
  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={t("workspace.tools")}
        title={t("forms.title")}
        description={t("forms.subtitle")}
      />
      <div className="flex min-h-[45vh] flex-col items-center justify-center  p-8 text-center">
        <span className="workspace-brand-icon mb-5 flex size-14 items-center justify-center rounded-2xl">
          <FileStack className="size-6" />
        </span>
        <h2 className="text-lg font-semibold">{t("forms.coming_soon")}</h2>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
          {t("workspace.soon_description")}
        </p>
        <Link
          to="/dashboard"
          className={buttonVariants({ variant: "outline", className: "mt-6" })}
        >
          <ArrowLeft />
          {t("workspace.back_documents")}
        </Link>
      </div>
    </div>
  );
};
