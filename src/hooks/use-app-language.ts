import { useConfig } from "./use-config";

/** Subscribe through the root config owner, without another IPC listener. */
export const useAppLanguage = () => useConfig().config?.language ?? "en";
