import { WebSocket } from "ws";
import { type AnonymousState } from "../utils";
import { BaseOnMessage } from "./base-on-message";

export class AnonMessage extends BaseOnMessage<AnonymousState> {
  constructor(
    sender: WebSocket,
    client: AnonymousState,
    connections: ReadonlySet<WebSocket>,
    onClientChange: () => void,
  ) {
    super(sender, client, connections, onClientChange);
  }

  protected dispatch(msg: WSMessage): void {
    switch (msg.type) {
      case "ping":
        return this.onPing();
      case "info":
        return this.onInfo();
      case "lookup":
        return this.onLookup(msg);
      case "comment":
        return this.reply({ type: "error", payload: { message: "unallowed" } });
      case "rename":
        return this.onRename(msg);
    }
  }
}
