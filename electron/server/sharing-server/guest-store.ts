import { WebSocket } from "ws";
import {
  type GuestState,
  type AnonymousState,
  type AnyGuest,
  type HostState,
  SHARING_ROLES,
  makeGuest,
  makeHost,
  randomCode,
  toParticipant,
} from "./utils";
import { SharingServer } from ".";
import { NetworkService } from "@main/service/network-service";

export class GuestStore {
  private readonly host = makeHost();
  private guests = new Map<string, GuestState>();
  private anonGuests = new Set<AnonymousState>();

  private static _instance: GuestStore | null = null;
  private _invitationCodes: InvitationGuest[] = [];
  static get instance() {
    return this._instance!;
  }

  constructor(type: SharingType) {
    this.guests = new Map(
      SHARING_ROLES[type].map((role) => {
        const guest = makeGuest(role);
        return [guest.invitationCode, guest];
      }),
    );
    GuestStore._instance = this;
  }
  async publicInvitation() {
    const currentNetwork = await NetworkService.getCurrent();
    if (!currentNetwork) return "";
    return Buffer.from(
      JSON.stringify({
        ip: NetworkService.getLocalIP(),
        host: SharingServer.instance.lanUrl,
        ssid: currentNetwork.ssid,
        bssid: currentNetwork.bssid || "",
        sharingId: SharingServer.instance.sharingId,
      } satisfies InvitationJson),
      "utf8",
    ).toString("base64");
  }
  async tap() {
    const currentNetwork = await NetworkService.getCurrent();
    if (!currentNetwork) return;

    this._invitationCodes = Array.from(this.guests.values()).map((v) => {
      const code = v.invitationCode;
      const obj = {
        ip: NetworkService.getLocalIP(),
        host: SharingServer.instance.lanUrl,
        ssid: currentNetwork.ssid,
        bssid: currentNetwork.bssid || "",
        code,
        sharingId: SharingServer.instance.sharingId,
      } satisfies InvitationJson;
      return {
        _code: Buffer.from(JSON.stringify(obj), "utf8").toString("base64"),
        role: v.role,
        code: v.invitationCode,
      };
    });
  }

  byCode(code: string | null): GuestState | undefined {
    if (!code) return undefined;
    return this.guests.get(code);
  }

  get invitationCodes(): InvitationGuest[] {
    return this._invitationCodes;
  }

  createAnon(): AnonymousState {
    const anon: AnonymousState = {
      id: randomCode(),
      ws: null,
      role: "anonymous",
      canComment: false,
      name: `guest.${randomCode()}`,
    };
    this.anonGuests.add(anon);
    return anon;
  }

  hostClient(): HostState {
    return this.host;
  }

  removeAnon(anon: AnonymousState): void {
    this.anonGuests.delete(anon);
  }

  resolveGuest(code: string): AnyGuest {
    return this.byCode(code) ?? this.createAnon();
  }

  kickStaleConnection(guest: AnyGuest): void {
    if (guest.ws) {
      guest.ws.close();
      guest.ws = null;
    }
  }

  onDisconnect(guest: AnyGuest, _ws: WebSocket): void {
    guest.ws = null;
    if (guest.role === "anonymous") this.removeAnon(guest);
  }

  getGuests() {
    return [
      this.host,
      ...this.guests.values(),
      ...this.anonGuests.values(),
    ].map(toParticipant);
  }

  destroy() {
    GuestStore._instance = null;
  }
}
