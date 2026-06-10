import http from "node:http";
import type { IncomingMessage as HttpIncomingMessage } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { networkInterfaces } from "os";
import { randomBytes } from "node:crypto";
import { CategoryService } from "../service/category-service";




type IncomingComment = SelectionPayload & {
  role: string;
  invitationCode: string;
};


type GuestState = {
  ws: WebSocket | null;
  role: SharingGuestRole;
  invitationCode: string;
  canComment: boolean;
};

type AnonymousState = Pick<GuestState,'ws'> & {role:string}

const sharingRoles = {
  advising: ["main_advisor", "second_advisor"],
  proposalSeminar: ["main_advisor", "second_advisor", "member_1", "member_2"],
  finalDefense: [
    "leader",
    "main_advisor",
    "second_advisor",
    "member_1",
    "member_2",
  ],
} as const satisfies {
  [K in SharingType]: readonly SharingGuestRole[];
};


export class SharingServer {
  private server: http.Server | null = null;
  private wss: WebSocketServer | null = null;
  private _port = 0;

  public doc: Omit<HighTexDocument, "category"> & { category?: Category };
  private categoryId: string;

  private connections = new Set<WebSocket>();
  private guests = new Map<string, GuestState>();
  private anonGuest = new Set<AnonymousState>()

  private commentHistory: IncomingComment[] = [];

  constructor(
    public readonly type: SharingType,
    private images: SerialableImageRecord[],
    private snapshot: Snapshot,
    doc: HighTexDocument,
  ) {
    this.categoryId = doc.category;
    this.doc = { ...doc, category: undefined };

    this.guests = new Map(
      sharingRoles[this.type].map((role) => {
        const guest: GuestState = {
          ws: null,
          role,
          invitationCode: randomBytes(3).toString("hex").toUpperCase(),
          canComment: true,
        };

        return [guest.invitationCode, guest];
      }),
    );
  }
  get invitationCodes(): InvitationGuest[] {
    return [...this.guests.values()].map((g) => ({
      role: g.role,
      code: g.invitationCode,
    }));
  }

  get port() {
    return this._port;
  }

  get lanUrl() {
    return `http://${this.getLANAddress()}:${this._port}`;
  }

  async start(): Promise<void> {
    this.server = http.createServer((req, res) =>
      this.handleRequest(req, res),
    );

    this.doc.category = await CategoryService.get(this.categoryId);

    this.wss = new WebSocketServer({ noServer: true });

    this.server.on("upgrade", (req, socket, head) => {
      const url = new URL(req.url ?? "", "http://localhost");
      const code = url.searchParams.get("code") || url.pathname.replace("/","");
      console.log(this.guests,code)
      const guest = this.findGuestByCode(code);
      if(!guest){
        const anonymous:AnonymousState = {
          ws:null,
          role:"anonymous"
        }
        this.anonGuest.add(anonymous)
        this.wss!.handleUpgrade(req,socket,head,(ws)=>{
          this.attach(ws,anonymous)
        })
        return
      }
      if(guest.ws){
        const oldWs = guest.ws;
        oldWs.close();
        guest.ws = null
      }
  

      this.wss!.handleUpgrade(req, socket, head, (ws) => {
        this.attach(ws, guest);
      });
    });

    await new Promise<void>((resolve) => {
      this.server!.listen(0, "0.0.0.0", () => {
        const addr = this.server!.address();
        if (addr && typeof addr !== "string") this._port = addr.port;
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    for (const ws of this.connections) {
      ws.close();
    }

    this.wss?.close();

    await new Promise<void>((resolve) => {
      this.server?.close(() => resolve());
    });

    this.server = null;
    this.wss = null;
    this._port = 0;

    this.connections.clear();
  }


  private attach(ws: WebSocket, guest: GuestState | AnonymousState) {
    guest.ws = ws;
    this.connections.add(ws);

    for (const c of this.commentHistory) {
      ws.send(JSON.stringify({ type: "comment", payload: c }));
    }

    ws.on("message", (raw) =>
      this.handleMessage(raw.toString(), guest),
    );

    ws.on("close", () => {
      guest.ws = null;
      this.connections.delete(ws);
    });
  }


  private handleMessage(raw: string, guest: GuestState | AnonymousState) {
    try {
      const msg: WSMessage = JSON.parse(raw);

      const handler = this.messageGate[msg.type];
      if (!handler) return;

      handler(msg as any, guest);
    } catch {

    }
  }

  private messageGate = {
    comment: (
      msg: Extract<WSMessage, { type: "comment" }>,
      guest: GuestState | AnonymousState,
    ) => {
      if(!("invitationCode" in guest)){
        guest.ws?.send(JSON.stringify({type:"error",payload:{message:"unallowed"}}))
        return
      }
      if (!guest.canComment)
        { 
           guest.ws?.send(JSON.stringify({type:"error",payload:{message:"unallowed"}}))
          return
        };

      const comment: IncomingComment = {
        role: guest.role,
        invitationCode: guest.invitationCode,
        ...msg.payload,
      };

      this.onComment(comment);
    },

    ping: (_msg: Extract<WSMessage, { type: "ping" }>, guest: GuestState | AnonymousState) => {
      guest.ws?.send(
        JSON.stringify({
          type: "pong",
          payload: { ts: Date.now() },
        }),
      );
    },
    info:(_msg: Extract<WSMessage, { type: "info" }>,  guest: GuestState | AnonymousState)=>{

          guest.ws?.send(
          JSON.stringify({
            type: "info",
            payload: { role: guest.role },
          }),
        );
      }
    };


  onComment(comment: IncomingComment) {
    this.commentHistory.push(comment);

    const payload = JSON.stringify({
      type: "comment",
      payload: comment,
    } satisfies WSMessage);

    for (const ws of this.connections) {
      ws.send(payload);
    }
  }


  private async handleRequest(
    req: HttpIncomingMessage,
    res: http.ServerResponse,
  ) {
    try {
      res.setHeader("Access-Control-Allow-Origin", "*");

      const url = new URL(req.url ?? "", "http://localhost");
      const pathname = url.pathname;
      const code = url.searchParams.get("code");

      const guest = this.findGuestByCode(code);

      const isSnapshot = pathname === "/snapshot";
      const isImage = pathname.startsWith("/share/image/");

      if (!guest && !isSnapshot && !isImage) {
        res.statusCode = 403;
        return res.end(JSON.stringify({ error: "Invalid code" }));
      }

      if (isSnapshot) return this.handleSnapshot(res, guest);

      if (isImage) {
        const id = pathname.split("/share/image/")[1];
        return this.handleImage(res, id);
      }

      res.statusCode = 404;
      res.end("Not found");
    } catch (err) {
      console.error(err);
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  }

  private handleSnapshot(res: http.ServerResponse, guest?: GuestState) {
    res.setHeader("Content-Type", "application/json");

    res.end(
      JSON.stringify({
        snapshot: this.snapshot,
        guest,
      }),
    );
  }

  private handleImage(res: http.ServerResponse, id: string) {
    const image = this.images.find((i) => i.id === id);

    if (!image) {
      res.statusCode = 404;
      return res.end("Image not found");
    }

    res.setHeader("Content-Type", "image/webp");
    res.end(image.buffer);
  }


  private findGuestByCode(code: string | null): GuestState | undefined {
    if (!code) return undefined;
    return this.guests.get(code);
  }


  private getLANAddress(): string {
    const nets = networkInterfaces();

    for (const iface of Object.values(nets)) {
      for (const net of iface ?? []) {
        if (net.family === "IPv4" && !net.internal) {
          return net.address;
        }
      }
    }

    return "127.0.0.1";
  }

  getSnapshot() {
    return this.snapshot;
  }
}