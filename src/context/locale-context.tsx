import { createContext, PropsWithChildren, useEffect, useState } from "react";
import {
  getCurrentLanguage,
  setCurrentLanguage,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from "@/utils/lang";

export const LocaleContext = createContext<{ locale: SupportedLanguage }>({
  locale: "en",
});

export const LocaleProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const [locale, setLocale] = useState(getCurrentLanguage);

  useEffect(() => {
    setCurrentLanguage(getCurrentLanguage());
    return window.config?.onChange?.((c) => {
      const language = SUPPORTED_LANGUAGES.includes(c.language) ? c.language : "en";
      setCurrentLanguage(language);
      setLocale(language);
    });
  }, []);
  return (
    <LocaleContext.Provider value={{ locale }}>
      {children}
    </LocaleContext.Provider>
  );
};
