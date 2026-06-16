import { WebSocket } from "ws";
import { randomBytes } from "node:crypto";

export type IncomingComment = SelectionPayload & {
  participantId: string;
  role: SharingParticipantRole;
  name: string;
  invitationCode?: string;
};

export type ClientState = {
  id: string;
  ws: WebSocket | null;
  name: string;
  role: SharingParticipantRole;
  canComment: boolean;
};

export type HostState = ClientState & {
  role: "host";
};

export type GuestState = ClientState & {
  role: SharingGuestRole;
  invitationCode: string;
};

export type AnonymousState = ClientState & {
  role: "anonymous";
};

export type AnyGuest = HostState | GuestState | AnonymousState;

export const SHARING_ROLES = {
  advising: ["main_advisor", "second_advisor"],
  proposalSeminar: ["main_advisor", "second_advisor", "member_1", "member_2"],
  finalDefense: [
    "leader",
    "main_advisor",
    "second_advisor",
    "member_1",
    "member_2",
  ],
} as const satisfies { [K in SharingType]: readonly SharingGuestRole[] };

export function isGuest(guest: AnyGuest): guest is GuestState {
  return guest.role !== "anonymous" && guest.role !== "host";
}

export function randomCode(): string {
  return randomBytes(3).toString("hex").toUpperCase();
}

export function makeGuest(role: SharingGuestRole): GuestState {
  const staticCode = randomCode();
  return {
    id: staticCode,
    ws: null,
    role,
    invitationCode: staticCode,
    canComment: true,
    name: role
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" "),
  };
}

export function makeHost(): HostState {
  return {
    id: "host",
    ws: null,
    role: "host",
    canComment: true,
    name: "Document owner",
  };
}

export function toIdentity(client: AnyGuest): SharingIdentity {
  return {
    id: client.id,
    name: client.name,
    role: client.role,
    canComment: client.canComment,
    invitationCode: isGuest(client) ? client.invitationCode : undefined,
  };
}

export function toParticipant(client: AnyGuest): SharingParticipant {
  return {
    ...toIdentity(client),
    connected: client.ws !== null,
  };
}

export function emit(ws: WebSocket | null, msg: WSMessage): void {
  ws?.send(JSON.stringify(msg));
}
