import { useEffect, useState } from "react";
import en from "@/locales/en.json";
import id from "@/locales/id.json";

export const SUPPORTED_LANGUAGES = ["en", "id"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const LOCALE_MESSAGES: Record<SupportedLanguage, Record<string, string>> = {
  en: en as Record<string, string>,
  id: id as Record<string, string>,
};

let currentLanguage: SupportedLanguage = "en";

export const LANGUAGE_OPTIONS: Array<{ value: SupportedLanguage; label: string }> = [
  { value: "en", label: "English" },
  { value: "id", label: "Bahasa Indonesia" },
];

export const getLanguageLabel = (language: SupportedLanguage = "en") => {
  return (
    LANGUAGE_OPTIONS.find((item) => item.value === language)?.label ?? "English"
  );
};

export const getCurrentLanguage = (): SupportedLanguage => {
  if (typeof window === "undefined" || !window.config?.get) {
    return currentLanguage;
  }

  const nextLanguage = (window.config.get()?.language ?? currentLanguage) as SupportedLanguage;
  currentLanguage = SUPPORTED_LANGUAGES.includes(nextLanguage)
    ? nextLanguage
    : "en";

  return currentLanguage;
};

export const setCurrentLanguage = (language: SupportedLanguage = "en") => {
  currentLanguage = SUPPORTED_LANGUAGES.includes(language) ? language : "en";
  if (typeof document !== "undefined") {
    const root = document.documentElement;
    root.lang = currentLanguage === "id" ? "id" : "en";
    root.dataset.lang = currentLanguage;
  }
};

export const useAppLanguage = () => {
  const [language, setLanguage] = useState<SupportedLanguage>(() =>
    getCurrentLanguage(),
  );

  useEffect(() => {
    if (typeof window === "undefined" || !window.config?.onChange) {
      return;
    }

    const unsubscribe = window.config.onChange((config) => {
      const nextLanguage = (config.language ?? "en") as SupportedLanguage;
      setCurrentLanguage(nextLanguage);
      setLanguage(nextLanguage);
    });

    return unsubscribe;
  }, []);

  return language;
};

export const t = (key: string, language?: SupportedLanguage) => {
  const activeLanguage = language ?? getCurrentLanguage();
  return LOCALE_MESSAGES[activeLanguage]?.[key] ?? LOCALE_MESSAGES.en[key] ?? key;
};

export const applyLanguage = (language: SupportedLanguage = "en") => {
  setCurrentLanguage(language);
};

if (typeof window !== "undefined" && window.config?.onChange) {
  window.config.onChange((config) => {
    setCurrentLanguage((config.language ?? "en") as SupportedLanguage);
  });
}
