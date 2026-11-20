import { useContext } from "react";
import { LocaleContext } from "@/context/locale-context";

/** Read the root-owned language; consumers do not subscribe to config themselves. */
export const useAppLanguage = () => useContext(LocaleContext).locale;
