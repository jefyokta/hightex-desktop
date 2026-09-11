import { t, useAppLanguage } from "@/utils/lang";

export const Forms = () => {
  const language = useAppLanguage();

  return (
    <>
      <div>
        <h1 className="text-xl font-semibold text-foreground">
          {t("forms.title", language)}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("forms.subtitle", language)}
        </p>
      </div>
      <div>
        <h1>{t("forms.coming_soon", language)}</h1>
      </div>
    </>
  );
};
