import React from "react";
import { createRoot } from "react-dom/client";
import { ConfigContextProvider } from "@/context/config-context";
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
    root.render(<ConfigContextProvider>{[0, 1, 2].map(key => <Consumer key={key} />)}</ConfigContextProvider>);
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

export async function reviewConfigOwner() {
  const { useConfig } = await import("@/hooks/use-config");
  const original = window.config;
  const initial = original.get()!;
  let current = structuredClone(initial);
  const listeners = new Set<(config: ConfigShape) => void>();
  const patches: ConfigPatch[] = [];
  let configReads = 0;
  let api: ReturnType<typeof useConfig> | undefined;
  window.config = {
    ...original,
    ready: async () => current,
    get: () => { configReads++; return current; },
    onChange: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    set: async patch => {
      patches.push(structuredClone(patch));
      current = {
        ...current,
        ...patch,
        editor: { ...current.editor, ...patch.editor },
        previewer: { ...current.previewer, ...patch.previewer },
        export: { ...current.export, ...patch.export },
        zotero: { ...current.zotero, ...patch.zotero },
      };
      for (const listener of listeners) listener(current);
      return current;
    },
    reset: async () => {
      current = structuredClone(initial);
      for (const listener of listeners) listener(current);
      return current;
    },
  };
  const rootElement = document.createElement("div");
  document.body.append(rootElement);
  const root = createRoot(rootElement);
  const frame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  function Consumer() { api = useConfig(); return <span>{api.config?.theme}:{t("common.cancel")}</span>; }
  try {
    root.render(<ConfigContextProvider><Consumer /></ConfigContextProvider>);
    await frame();
    const save = api!.saveConfig;
    // Reuse the initial callback after an unrelated update, as a long-lived UI action would.
    await save({ theme: "dark" });
    await save({ editor: { pagination: true } });
    await frame();
    const preserved = api!.config?.theme === "dark" && api!.config.editor.pagination === true;
    const stable = api!.saveConfig === save;
    await save({ language: "id" });
    await frame();
    const translated = rootElement.textContent?.includes("Batal");
    await api!.resetConfig();
    await frame();
    const reset = api!.config?.theme === initial.theme;
    const beforeTranslations = configReads;
    for (let index = 0; index < 20; index++) t("common.cancel");
    const translationReads = configReads - beforeTranslations;
    return { patches, preserved, stable, translated, reset, translationReads, listeners: listeners.size };
  } finally {
    root.unmount();
    rootElement.remove();
    window.config = original;
  }
}
