import React from "react";
import { createRoot } from "react-dom/client";
import { LocaleProvider } from "@/context/locale-context";
import { useAppLanguage } from "@/hooks/use-app-language";
import { t } from "@/utils/lang";

export async function reviewRootLanguage() {
  const original = window.config;
  const config = original.get();
  if (!config) throw Error("Language fixture requires initialized config");
  const host = document.createElement("div");
  document.body.append(host);
  const listeners = new Set<(config: ConfigShape) => void>();
  let language: SupportedLanguage = "en", subscriptions = 0;
  window.config = {
    ...original,
    get: () => ({ ...config, language }),
    onChange: callback => {
      subscriptions++;
      listeners.add(callback);
      return () => { listeners.delete(callback); };
    },
  };
  const root = createRoot(host);
  const frame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const Consumer = React.memo(function Consumer() {
    const language = useAppLanguage();
    return <span>{language}:{t("common.cancel")}</span>;
  });
  const result = { listeners: 0, subscriptions: 0, en: "", id: "", rootLanguage: "", cleanup: 0 };
  try {
    root.render(<LocaleProvider>{[0, 1, 2].map(key => <Consumer key={key} />)}</LocaleProvider>);
    await frame();
    result.listeners = listeners.size;
    result.subscriptions = subscriptions;
    result.en = host.textContent ?? "";
    language = "id";
    for (const callback of listeners) callback({ ...config, language });
    await frame();
    result.id = host.textContent ?? "";
    result.rootLanguage = document.documentElement.lang;
  } finally {
    root.unmount();
    result.cleanup = listeners.size;
    host.remove();
    window.config = original;
  }
  return result;
}
