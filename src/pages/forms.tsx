import { t } from "@/utils/lang";

export const Forms = () => {

  return (
    <>
      <div>
        <h1 className="text-xl font-semibold text-foreground">
          {t("forms.title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("forms.subtitle")}
        </p>
      </div>
      <div>
        <h1>{t("forms.coming_soon")}</h1>
      </div>
    </>
  );
};
