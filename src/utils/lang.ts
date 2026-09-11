import en from "@/locales/en.json";
import id from "@/locales/id.json";

export const SUPPORTED_LANGUAGES = ["en", "id"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const LOCALE_MESSAGES: Record<SupportedLanguage, Record<string, string>> = {
  en: en as Record<string, string>,
  id: id as Record<string, string>,
};

export const LANGUAGE_OPTIONS: Array<{ value: SupportedLanguage; label: string }> = [
  { value: "en", label: "English" },
  { value: "id", label: "Bahasa Indonesia" },
];

export const getLanguageLabel = (language: SupportedLanguage = "en") => {
  return LANGUAGE_OPTIONS.find((item) => item.value === language)?.label ?? "English";
};

export const t = (key: string, language: SupportedLanguage = "en") => {
  return LOCALE_MESSAGES[language]?.[key] ?? LOCALE_MESSAGES.en[key] ?? key;
};

export const applyLanguage = (language: SupportedLanguage = "en") => {
  const root = document.documentElement;
  root.lang = language === "id" ? "id" : "en";
  root.dataset.lang = language;
};
