import { WebSocket } from "ws";
import { type AnyGuest, toIdentity } from "../utils";

type Data<T> = T | ((ws: WebSocket) => T);

export abstract class BaseOnMessage<TClient extends AnyGuest = AnyGuest> {
  private targets: ReadonlySet<WebSocket> | null = null;

  constructor(
    protected readonly sender: WebSocket,
    protected readonly client: TClient,
    private readonly connections: ReadonlySet<WebSocket>,
    private readonly onClientChange: () => void,
  ) {}

  readonly handle = (raw: Buffer): void => {
    try {
      this.dispatch(JSON.parse(raw.toString()) as WSMessage);
    } catch {}
  };

  protected abstract dispatch(msg: WSMessage): void;

  protected reply<T>(data: T): void {
    this.sender.send(JSON.stringify(data));
  }

  protected to(fds: WebSocket | WebSocket[] | ReadonlySet<WebSocket>): this {
    if (fds instanceof WebSocket) {
      this.targets = new Set([fds]);
    } else if (Array.isArray(fds)) {
      this.targets = new Set(fds);
    } else {
      this.targets = fds;
    }
    return this;
  }

  protected broadcast<T>(data: Data<T>, excludeSelf = false): void {
    const pool = this.targets ?? this.connections;
    this.targets = null;

    for (const ws of pool) {
      if (excludeSelf && ws === this.sender) continue;
      const payload =
        typeof data === "function" ? (data as (ws: WebSocket) => T)(ws) : data;
      ws.send(JSON.stringify(payload));
    }
  }

  protected kick(reason = "Kicked by server"): void {
    this.sender.close(1000, reason);
  }

  protected onPing(): void {
    this.reply<PongMessage>({ type: "pong", payload: { ts: Date.now() } });
  }

  protected onInfo(): void {
    this.reply<InfoMessage>({ type: "info", payload: toIdentity(this.client) });
  }

  protected onLookup(
    msg: Extract<WSMessage<"client">, { type: "lookup" }>,
  ): void {
    this.broadcast<LookUpMessage<"server">>({
      ...msg,
      payload: {
        ...msg.payload,
        role: this.client.role,
        name: this.client.name,
        participantId: this.client.id,
      },
    });
  }
  protected onRename(msg: Extract<WSMessage, { type: "rename" }>): void {
    this.client.name = msg.payload.name;
    this.reply<RenameMessage>({
      type: "rename",
      payload: { name: msg.payload.name },
    });
    this.onClientChange();
  }
}
