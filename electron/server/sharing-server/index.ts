import http from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { CategoryService } from "@main/service/category-service";
import { GuestStore } from "./guest-store";
import { OnRequest } from "./events/on-request";
import {
  type IncomingComment,
  type AnyGuest,
  emit,
  randomCode,
  toIdentity,
  AnonymousState,
} from "./utils";
import { Comment } from "@main/database/models/comment";
import { GuestMessage } from "./events/on-guest-message";
import { NetworkService } from "@main/service/network-service";
import { NetworkException } from "@main/exception/network-exception";
import { AnonMessage } from "./events/on-anon-message";
import { randomUUID } from "node:crypto";
import { SnapshotService } from "@main/service/snapshot-service";

export class SharingServer {
  private server: http.Server | null = null;
  private wss: WebSocketServer | null = null;
  private _port = 0;
  public doc: Omit<HighTexDocument, "category"> & { category?: Category };
  private readonly categoryId: string;
  private readonly connections = new Set<WebSocket>();
  private readonly store: GuestStore;
  private readonly onRequest: OnRequest;

  public publicInvitation = "";
  private readonly sessionId: SharingType | string;
  private readonly _hostToken = randomCode();
  private lastLanAddr: string = "";
  private static _instance: SharingServer | null = null;
  public onNetworkChanged: (
    oldAddr: string,
    newAddr: string,
    server: SharingServer,
  ) => boolean = (_, __, ___) => true;
  private commentHistory: IncomingComment[] = [];

  constructor(
    public readonly type: SharingType,
    private images: SerialableImageRecord[],
    private readonly snapshot: Snapshot,
    doc: HighTexDocument,
  ) {
    this.categoryId = doc.category;
    this.doc = { ...doc, category: undefined };
    this.sessionId = this.type == "advising" ? crypto.randomUUID() : this.type;
    this.store = new GuestStore(type);
    this.onRequest = new OnRequest(
      snapshot,
      images,
      (code) => this.store.byCode(code),
      (token) => token === this._hostToken,
      this.sessionId,
    );
    SharingServer._instance = this;
  }

  get invitationCodes(): InvitationGuest[] {
    return this.store.invitationCodes;
  }

  get port(): number {
    return this._port;
  }



  get lanUrl(): string {
    return `http://${NetworkService.getLocalIP()}:${this._port}`;
  }
  static get instance() {
    return this._instance!;
  }

  get hostToken(): string {
    return this._hostToken;
  }
  get sharingId(){
    return this.sessionId
  }

  private url(url = "") {
    return new URL(url, "http://localhost");
  }
  async base64Invitation(code: string) {
    const currentNetwork = await NetworkService.getCurrent();
    if (!currentNetwork) return;

    const obj = {
      ip: NetworkService.getLocalIP(),
      host: this.lanUrl,
      ssid: currentNetwork.ssid,
      bssid: currentNetwork.bssid,
      code,
    };
    return Buffer.from(JSON.stringify(obj), "utf8").toBase64();
  }
  private watchNetwork() {
    const currentNetwork = NetworkService.getLocalIP();

    const timerId = setInterval(async () => {
      if (this.lastLanAddr.trim() && currentNetwork == this.lastLanAddr) {
        const shouldStop = this.onNetworkChanged(
          this.lastLanAddr,
          currentNetwork,
          this,
        );
        if (shouldStop) {
          await this.stop();
          clearInterval(timerId);
        }
      }
    }, 1000);
  }

  async start(): Promise<void> {
    const status = await NetworkService.getLanStatus();
    const net = await NetworkService.getCurrent();
    if (!net) throw new NetworkException("You are not connected to any wifi");
    if (!status.exposed) {
      throw new NetworkException(status.reason);
    }
    SnapshotService.create({ 
       images: this.images,
       id:this.sessionId,
       type:this.sessionId,
       documentId:this.doc.id,
       html:this.snapshot.html,
       css:this.snapshot.css,

    });
    this.server = http.createServer((req, res) =>
      this.onRequest.handle(req, res),
    );
    this.doc.category = await CategoryService.get(this.categoryId);
    this.wss = new WebSocketServer({ noServer: true });

    this.server.on("upgrade", (req, socket, head) => {
      const url = this.url(req.url);
      const isHost = url.searchParams.get("client") === "host";
      const hostToken = url.searchParams.get("token");
      const code =
        url.searchParams.get("code") || url.pathname.replace("/", "");
      if (isHost && hostToken !== this._hostToken) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }
      const guest = isHost ? this.store.hostClient() : this.store.byCode(code);
      const client = guest ?? this.store.createAnon();

      if (guest) {
        this.store.kickStaleConnection(guest);
      }

      this.wss!.handleUpgrade(req, socket, head, (ws) => {
        const onMessage = guest
          ? new GuestMessage(
              ws,
              client,
              this.connections,
              () => this.broadcastGuests(),
              (c) => this.onComment(c),
            )
          : new AnonMessage(
              ws,
              client as AnonymousState,
              this.connections,
              () => this.broadcastGuests(),
            );
        ws.on("message", onMessage.handle);
        this.attach(ws, client);
      });
    });
    this.wss.addListener("error", (e) => {
      console.error(e);
    });

    await new Promise<void>((resolve) => {
      this.server!.listen(0, "0.0.0.0", () => {
        const addr = this.server!.address();
        if (addr && typeof addr !== "string") this._port = addr.port;
        resolve();
      });
    });

    this.publicInvitation = await this.store.publicInvitation();
    await this.store.tap();
    this.watchNetwork();
  }

  async stop(): Promise<void> {
    for (const ws of this.connections) ws.close();

    this.wss?.close();

    await new Promise<void>((resolve) => {
      this.server?.close(() => resolve());
    });
    this.store.destroy();
    this.server = null;
    this.wss = null;
    this._port = 0;
    this.connections.clear();
    SharingServer._instance = null;
  }

  onComment(comment: IncomingComment): void {
    const id = randomUUID();
    this.commentHistory.push({ ...comment, id });
    Comment.query().create({
      text: comment.text,
      data: {
        start: comment.start,
        spanningUUIDs: comment.spanningUUIDs,
        end: comment.end,
      } satisfies Omit<SelectionPayload, "text">,
      id,
      role: comment.role,
      participantId: comment.participantId,
      snapshotId:this.sessionId
    });
    const msg = JSON.stringify({
      type: "comment",
      payload: { ...comment, id },
    } satisfies WSMessage<"server">);
    for (const ws of this.connections) {
      ws.send(msg);
    }
  }

  getSnapshot(): Snapshot {
    return this.snapshot;
  }

  private attach(ws: WebSocket, guest: AnyGuest): void {
    guest.ws = ws;
    this.connections.add(ws);

    emit(ws, { type: "info", payload: toIdentity(guest) });
    emit(ws, {
      type: "sharingInfo",
      payload: {
        document: this.doc,
        type: this.type,
      },
    });

    for (const c of this.commentHistory) {
      emit(ws, { type: "comment", payload: c });
    }
    this.broadcastGuests();

    ws.on("close", () => {
      this.connections.delete(ws);
      this.store.onDisconnect(guest, ws);
      this.broadcastGuests();
    });
  }

  private broadcastGuests(): void {
    const guests = this.store.getGuests();
    for (const con of this.connections) {
      emit(con, {
        type: "guests",
        payload: {
          guests,
          guest: guests,
        },
      });
    }
  }
}
