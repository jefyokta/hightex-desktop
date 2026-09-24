import {
    createContext,
    ReactNode,
    useCallback,
    useEffect,
    useState,
} from "react";

type ConfigContextShape = {
    config?: ConfigShape;
    saveConfig: (config: Partial<ConfigShape>) => Promise<void>;
};

export const ConfigContext = createContext<ConfigContextShape>({
    config: undefined,

    async saveConfig() { },
});

type ConfigContextProviderProps = {
    children?: ReactNode;
};

export const ConfigContextProvider: React.FC<
    ConfigContextProviderProps
> = ({ children }) => {
    const [config, setConfig] = useState<ConfigShape | undefined>(
        () => window.config.get() || undefined,
    );

    const saveConfig = useCallback(
        async (partialConfig: Partial<ConfigShape>): Promise<void> => {
            const nextConfig = {
                ...(config || {}),
                ...partialConfig,
            } as ConfigShape;

            await window.config.set(nextConfig);
        },
        [config],
    );

    useEffect(() => {
        return window.config.onChange((nextConfig) => {
            setConfig(nextConfig);
        });
    }, []);

    return (
        <ConfigContext.Provider value={{ config, saveConfig }}>
            {children}
        </ConfigContext.Provider>
    );
};
