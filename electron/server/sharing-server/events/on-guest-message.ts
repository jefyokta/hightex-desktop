import { WebSocket } from "ws";
import { type AnyGuest, type IncomingComment, isGuest } from "../utils";
import { BaseOnMessage } from "./base-on-message";

type CommentCallback = (comment: IncomingComment) => void;

export class GuestMessage extends BaseOnMessage<AnyGuest> {
  constructor(
    sender: WebSocket,
    client: AnyGuest,
    connections: ReadonlySet<WebSocket>,
    onClientChange: () => void,
    private readonly onComment: CommentCallback,
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
        if (this.client.role === "anonymous") {
          return this.reply({
            type: "error",
            payload: { message: "Anonymous viewers cannot broadcast lookup" },
          });
        }
        return this.onLookup(msg);
      case "comment":
        return this.onComment_(msg);
      case "rename":
        return this.onRename(msg);
    }
  }

  private onComment_(msg: Extract<WSMessage, { type: "comment" }>): void {
    if (!this.client.canComment) {
      this.reply({ type: "error", payload: { message: "unallowed" } });
      return;
    }

    this.onComment({
      participantId: this.client.id,
      role: this.client.role,
      name: this.client.name,
      id: "",
      invitationCode: isGuest(this.client)
        ? this.client.invitationCode
        : undefined,
      ...msg.payload,
    });
  }
}
