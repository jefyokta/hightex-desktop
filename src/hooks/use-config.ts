import { ConfigContext } from "@/context/config-context";
import { useContext } from "react";

export const useConfig = () => {
    return useContext(ConfigContext);
};