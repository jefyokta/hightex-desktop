import { SharingException } from "@/exception/sharing-exception";
import React, {
    createContext,
    PropsWithChildren,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react";

type GuestMessage<T = any> = {
    type: string;
    payload?: T;
};

interface HostConnect {
    port: string;
}

interface GuestConnect extends HostConnect {
    host: string;
    code: string;
}

type SharingContextApi = {
    connected: boolean;
    messages: GuestMessage[];

    connectHost(port: string): Promise<void>;
    connectGuest(
        host: string,
        port: string,
        code: string
    ): Promise<void>;

    disconnect(): void;
    send(payload: WSMessage): void;
};

const SharingContext = createContext<SharingContextApi | null>(null);

function wsUrl(host: string, port: string, code?: string) {
    const base = `ws://${host}:${port}/`;

    if (!code) {
        return base;
    }

    const u= `${base}${encodeURIComponent(code)}`;
    console.log(u)
    return u
}

export const SharingContextProvider: React.FC<PropsWithChildren> = ({
    children,
}) => {
    const [connected, setConnected] = useState(false);
    const [messages, setMessages] = useState<GuestMessage[]>([]);

    const wsRef = useRef<WebSocket | null>(null);

    const disconnect = useCallback(() => {
        if (wsRef.current) {
            try {
                wsRef.current.close();
            } catch { }

            wsRef.current = null;
        }

        setConnected(false);
    }, []);

    const connect = useCallback(
        (opt: HostConnect | GuestConnect): Promise<void> => {
            return new Promise((resolve, reject) => {
                disconnect();
                const isGuest = "host" in opt;
                console.log(opt,isGuest)

                const url = isGuest
                    ? wsUrl(opt.host, opt.port, opt.code)
                    : wsUrl("127.0.0.1", opt.port);

                const ws = new WebSocket(url);

                wsRef.current = ws;

                let settled = false;

                const fail = (message: string) => {
                    if (settled) {
                        return;
                    }

                    settled = true;

                    try {
                        ws.close();
                    } catch { }

                    reject(new SharingException(message));
                };

                ws.addEventListener(
                    "open",
                    () => {
                        if (settled) {
                            return;
                        }

                        settled = true;
                        setConnected(true);

                        resolve();
                    },
                    { once: true }
                );

                ws.addEventListener(
                    "error",
                    (e) => {
                        console.log(e)
                        if (isGuest) {
                            fail(
                                `Unable to connect to sharing host ${opt.host}:${opt.port}`
                            );
                        } else {
                            fail(
                                `Sharing server is not running on port ${opt.port}`
                            );
                        }
                    },
                    { once: true }
                );

                ws.addEventListener("message", (event) => {
                    try {
                        const message = JSON.parse(event.data);

                        if (message?.type === "error") {
                            fail(
                                message.payload.message ??
                                "Sharing connection rejected"
                            );
                            return;
                        }

                        setMessages((prev) => [...prev, message]);
                    } catch { }
                });

                ws.addEventListener("close", () => {
                    if (wsRef.current === ws) {
                        wsRef.current = null;
                    }

                    setConnected(false);
                });
            });
        },
        [disconnect]
    );

    const connectHost = useCallback(
        (port: string) => connect({ port }),
        [connect]
    );

    const connectGuest = useCallback(
        (host: string, port: string, code: string) =>
            connect({
                host,
                port,
                code,
            }),
        [connect]
    );

    const send = useCallback((payload: WSMessage) => {
        const ws = wsRef.current;

        if (!ws) {
            throw new SharingException(
                "Sharing connection is not established"
            );
        }

        if (ws.readyState !== WebSocket.OPEN) {
            throw new SharingException(
                "Sharing connection is not ready"
            );
        }

        ws.send(
            JSON.stringify(payload)
        );
    }, []);

    useEffect(() => {
        return () => {
            disconnect();
        };
    }, [disconnect]);

    const value: SharingContextApi = {
        connected,
        messages,
        connectHost,
        connectGuest,
        disconnect,
        send,
    };

    return (
        <SharingContext.Provider value={value}>
            {children}
        </SharingContext.Provider>
    );
};

export const useSharing = () => {
    const context = useContext(SharingContext);

    if (!context) {
        throw new Error(
            "useSharing must be used within SharingContextProvider"
        );
    }

    return context;
};