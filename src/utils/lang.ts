import { useEffect, useState } from "react";

import en from "@/locales/en.json";
import id from "@/locales/id.json";
type TranslationKey<T> = {
  [K in keyof T & string]:
    T[K] extends Record<string, unknown>
      ? `${K}.${TranslationKey<T[K]>}`
      : K;
}[keyof T & string];

export type LocaleKey = TranslationKey<typeof en>;

export const SUPPORTED_LANGUAGES = ["en", "id"] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

type TranslationValue = string | number | boolean | null | undefined;

type TranslationValues = Record<string, TranslationValue>;

type TranslationObject = {
  [key: string]: string | TranslationObject;
};

const flattenTranslations = (
  object: TranslationObject,
  prefix = "",
): Record<string, string> => {
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(object)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === "string") {
      result[fullKey] = value;

      continue;
    }

    Object.assign(result, flattenTranslations(value, fullKey));
  }

  return result;
};

const LOCALE_MESSAGES: Record<SupportedLanguage, Record<string, string>> = {
  en: flattenTranslations(en as TranslationObject),
  id: flattenTranslations(id as TranslationObject),
};

let currentLanguage: SupportedLanguage = "en";

export const LANGUAGE_OPTIONS: Array<{
  value: SupportedLanguage;
  label: string;
}> = [
  {
    value: "en",
    label: "English",
  },
  {
    value: "id",
    label: "Bahasa Indonesia",
  },
];

export const getLanguageLabel = (
  language: SupportedLanguage = "en",
): string => {
  return (
    LANGUAGE_OPTIONS.find((item) => item.value === language)?.label ?? "English"
  );
};

export const getCurrentLanguage = (): SupportedLanguage => {
  if (typeof window === "undefined" || !window.config?.get) {
    return currentLanguage;
  }

  const configuredLanguage = window.config.get()?.language;

  const language = SUPPORTED_LANGUAGES.includes(
    configuredLanguage as SupportedLanguage,
  )
    ? (configuredLanguage as SupportedLanguage)
    : currentLanguage;

  currentLanguage = language;

  return currentLanguage;
};

export const setCurrentLanguage = (
  language: SupportedLanguage = "en",
): void => {
  currentLanguage = SUPPORTED_LANGUAGES.includes(language) ? language : "en";

  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;

  root.lang = currentLanguage;
  root.dataset.lang = currentLanguage;
};

export const useAppLanguage = (): SupportedLanguage => {
  const [language, setLanguage] = useState<SupportedLanguage>(() =>
    getCurrentLanguage(),
  );

  useEffect(() => {
    if (typeof window === "undefined" || !window.config?.onChange) {
      return;
    }

    const unsubscribe = window.config.onChange((config) => {
      const configuredLanguage = config.language;

      const language = SUPPORTED_LANGUAGES.includes(
        configuredLanguage as SupportedLanguage,
      )
        ? (configuredLanguage as SupportedLanguage)
        : "en";

      setCurrentLanguage(language);
      setLanguage(language);
    });

    return unsubscribe;
  }, []);

  return language;
};

const interpolate = (message: string, values?: TranslationValues): string => {
  if (!values) {
    return message;
  }

  return message.replace(/\{(\w+)\}/g, (placeholder, key: string) => {
    if (!(key in values)) {
      return placeholder;
    }

    const value = values[key];

    if (value === null || value === undefined) {
      return "";
    }

    return String(value);
  });
};

export const t = (key: LocaleKey, values?: TranslationValues): string => {
  const language = getCurrentLanguage();

  const message =
    LOCALE_MESSAGES[language]?.[key] ?? LOCALE_MESSAGES.en[key] ?? key;

  return interpolate(message, values);
};

export const applyLanguage = (language: SupportedLanguage = "en"): void => {
  setCurrentLanguage(language);
};

if (typeof window !== "undefined" && window.config?.onChange) {
  window.config.onChange((config) => {
    const configuredLanguage = config.language;

    const language = SUPPORTED_LANGUAGES.includes(
      configuredLanguage as SupportedLanguage,
    )
      ? (configuredLanguage as SupportedLanguage)
      : "en";

    setCurrentLanguage(language);
  });
}
