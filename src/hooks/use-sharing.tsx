import { ShouldNotified } from "@/exception/interfaces/should-notified";
import { SharingException } from "@/exception/sharing-exception";
import { createMarker } from "@/utils/sharing";
import React, {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

interface HostConnect {
  port: string;
  token: string;
}
interface Send {
  (msg: WSMessage): void;
  <T extends WSMessage["type"]>(
    type: T,
    payload: Extract<WSMessage, { type: T }>["payload"],
  ): void;
}

interface GuestConnect {
  host: string;
  port: string;
  code?: string;
}

type SharingContextApi = {
  connected: boolean;
  connecting: boolean;
  messages: WSMessage[];
  comments: (CommentMessage<"server"> | LookUpMessage<"server">)[];
  connectHost(port: string, token: string): Promise<void>;
  connectGuest(host: string, port: string, code: string): Promise<void>;
  connectAnonymous(host: string, port: string): Promise<void>;
  disconnect(): void;
  send: Send;
  rename(name: string): void;
  identity: SharingIdentity;
  data: SharingIdentity;
  guests: SharingParticipant[];
  participants: SharingParticipant[];
  canComment: boolean;
  generalInfo: SharingInfo["payload"] | undefined;
};

const SharingContext = createContext<SharingContextApi | null>(null);

function wsUrl(
  host: string,
  port: string,
  opt?: { code?: string; hostToken?: string },
) {
  const code = opt?.code?.trim();
  const query = new URLSearchParams();

  if (opt?.hostToken) {
    query.set("client", "host");
    query.set("token", opt.hostToken);
  }

  const suffix = query.size > 0 ? `?${query.toString()}` : "";

  if (!code) {
    return `ws://${host}:${port}/${suffix}`;
  }

  return `ws://${host}:${port}/${encodeURIComponent(code)}${suffix}`;
}

const MAX_ARR_LENGTH = 200;
const DEFAULT_IDENTITY: SharingIdentity = {
  id: "local",
  name: "Guest",
  role: "anonymous",
  canComment: false,
};

function appendBounded<T>(prev: T[], item: T): T[] {
  return [...prev.slice(-(MAX_ARR_LENGTH - 1)), item];
}

export const SharingContextProvider: React.FC<PropsWithChildren> = ({
  children,
}) => {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [messages, setMessages] = useState<WSMessage[]>([]);
  const [comments, setComments] = useState<
    (CommentMessage<"server"> | LookUpMessage<"server">)[]
  >([]);
  const [generalInfo, setGeneralInfo] = useState<
    SharingInfo["payload"] | undefined
  >();
  const [identity, setIdentity] = useState<SharingIdentity>(DEFAULT_IDENTITY);
  const [guests, setGuests] = useState<SharingParticipant[]>([]);

  const wsRef = useRef<WebSocket | null>(null);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }

    setConnected(false);
    setConnecting(false);
  }, []);

  const connect = useCallback(
    (opt: HostConnect | GuestConnect): Promise<void> => {
      return new Promise((resolve, reject) => {
        disconnect();
        const isGuest = "host" in opt;

        const url = isGuest
          ? wsUrl(opt.host, opt.port, { code: opt.code })
          : wsUrl("127.0.0.1", opt.port, { hostToken: opt.token });

        const ws = new WebSocket(url);

        wsRef.current = ws;
        setConnecting(true);
        setConnected(false);
        setMessages([]);
        setComments([]);
        setGuests([]);
        setIdentity(DEFAULT_IDENTITY);

        let settled = false;

        const fail = (message: string) => {
          if (settled) {
            return;
          }

          settled = true;

          try {
            ws.close();
          } catch {}

          reject(new ShouldNotified(message));
        };

        ws.addEventListener(
          "open",
          () => {
            if (settled) {
              return;
            }

            settled = true;
            setConnected(true);
            setConnecting(false);
            resolve();
          },
          { once: true },
        );

        ws.addEventListener(
          "error",
          (_e) => {
            setConnecting(false);
            if (isGuest) {
              fail(`Unable to connect to sharing host ${opt.host}:${opt.port}`);
            } else {
              fail(`Sharing server is not running on port ${opt.port}`);
            }
          },
          { once: true },
        );

        ws.addEventListener("message", (event) => {
          try {
            const message: WSMessage<"server"> = JSON.parse(event.data);

            if (message?.type === "error") {
              fail(message.payload.message ?? "Sharing connection rejected");
              return;
            }

            if (message?.type == "comment") {
              setComments((prev) => appendBounded(prev, message));
              console.log(message);
              requestAnimationFrame(() =>
                setTimeout(() => createMarker(message.payload), 100),
              );
              return;
            }

            if (message?.type == "lookup") {
              setComments((prev) => appendBounded(prev, message));
              return;
            }
            if (message.type == "info") {
              setIdentity(message.payload);
              return;
            }
            if (message.type == "guests") {
              setGuests(message.payload.guests ?? message.payload.guest ?? []);
              return;
            }
            if (message.type == "rename") {
              setIdentity((prev) => ({ ...prev, name: message.payload.name }));
              return;
            }

            if (message.type == "sharingInfo") {
              setGeneralInfo(message.payload);
              return;
            }

            setMessages((prev) => appendBounded(prev, message));
          } catch {}
        });

        ws.addEventListener("close", () => {
          if (wsRef.current === ws) {
            wsRef.current = null;
          }

          setConnected(false);
          setConnecting(false);
        });
      });
    },
    [disconnect],
  );

  const connectHost = useCallback(
    (port: string, token: string) => connect({ port, token }),
    [connect],
  );

  const connectGuest = useCallback(
    (host: string, port: string, code: string) => {
      return connect({ host, port, code });
    },
    [connect],
  );

  const connectAnonymous = useCallback(
    (host: string, port: string) => {
      return connect({ host, port });
    },
    [connect],
  );

  const send: Send = useCallback(
    (payloadOrType: WSMessage | WSMessage["type"], maybePayload?: any) => {
      const ws = wsRef.current;

      if (!ws) {
        throw new SharingException("Sharing connection is not established");
      }

      if (ws.readyState !== WebSocket.OPEN) {
        throw new SharingException("Sharing connection is not ready");
      }

      const data =
        typeof payloadOrType === "string"
          ? { type: payloadOrType, payload: maybePayload }
          : payloadOrType;

      ws.send(JSON.stringify(data));
    },
    [],
  );

  const rename = useCallback(
    (name: string) => {
      const nextName = name.trim();
      if (!nextName) {
        return;
      }

      send("rename", { name: nextName });
    },
    [send],
  );

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  const value: SharingContextApi = {
    connected,
    connecting,
    messages,
    connectHost,
    connectGuest,
    connectAnonymous,
    disconnect,
    send,
    rename,
    comments,
    identity,
    data: identity,
    guests,
    participants: guests,
    canComment: identity.canComment,
    generalInfo,
  };

  return (
    <SharingContext.Provider value={value}>{children}</SharingContext.Provider>
  );
};

export const useSharing = () => {
  const context = useContext(SharingContext);

  if (!context) {
    throw new Error("useSharing must be used within SharingContextProvider");
  }

  return context;
};
