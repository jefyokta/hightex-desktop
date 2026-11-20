import { setCurrentLanguage } from "@/utils/lang";
import {
  createContext,
  type ReactNode,
  useCallback,
  useEffect,
  useState,
} from "react";

type ConfigContextShape = {
  config?: ConfigShape;
  saveConfig: (config: Partial<ConfigShape>) => Promise<void>;
  resetConfig: () => Promise<void>;
};

export const ConfigContext = createContext<ConfigContextShape>({
  config: undefined,

  async saveConfig() {},
  async resetConfig() {},
});

type ConfigContextProviderProps = {
  children?: ReactNode;
};

export const ConfigContextProvider: React.FC<ConfigContextProviderProps> = ({
  children,
}) => {
  const [config, setConfig] = useState<ConfigShape | undefined>(() => {
    const initial = window.config.get();
    if (initial) setCurrentLanguage(initial.language);
    return initial ?? undefined;
  });
  const receiveConfig = useCallback((next: ConfigShape) => {
    // Legacy t() reads language synchronously while React renders its consumers.
    setCurrentLanguage(next.language);
    setConfig(next);
  }, []);

  const saveConfig = useCallback(async (patch: Partial<ConfigShape>) => {
    // The main-process service owns merging; do not resend a stale full snapshot.
    receiveConfig(await window.config.set(patch));
  }, [receiveConfig]);

  const resetConfig = useCallback(async () => {
    receiveConfig(await window.config.reset());
  }, [receiveConfig]);

  useEffect(() => {
    let active = true;
    const unsubscribe = window.config.onChange(next => {
      if (active) receiveConfig(next);
    });
    void window.config.ready().then(() => {
      const current = window.config.get();
      if (active && current) receiveConfig(current);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [receiveConfig]);

  return (
    <ConfigContext.Provider value={{ config, saveConfig, resetConfig }}>
      {children}
    </ConfigContext.Provider>
  );
};
