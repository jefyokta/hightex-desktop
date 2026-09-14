import { LocaleContext } from "@/context/locale-context";
import { useContext } from "react";

export const useLocale = () => useContext(LocaleContext)