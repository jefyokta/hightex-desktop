export {};

declare global {
  type SharingType = "advising" | "proposalSeminar" | "finalDefense";

  type SharingGuestRole =
    | "main_advisor"
    | "second_advisor"
    | "member_1"
    | "member_2"
    | "leader";

  type SharingGuest<Role extends SharingGuestRole = SharingGuestRole> = {
    invitationCode: string;
    role: Role;
  };

  type SharingRoles<T extends SharingType> = T extends "advising"
    ? "main_advisor" | "second_advisor"
    : T extends "proposalSeminar"
      ? Exclude<SharingGuestRole, "leader">
      : SharingGuestRole;

  type SharingSessionMap = {
    advising: {
      type: "advising";
      guests: SharingGuest<SharingRoles<"advising">>[];
    };

    proposalSeminar: {
      type: "proposalSeminar";
      guests: SharingGuest<SharingRoles<"proposalSeminar">>[];
    };

    finalDefense: {
      type: "finalDefense";
      guests: SharingGuest<SharingRoles<"finalDefense">>[];
    };
  };

  type SharingSession<T extends SharingType = SharingType> =
    SharingSessionMap[T];
  type InvitationJson = {
    ip: string;
    bssid: string;
    ssid: string;
    host: string;
    sharingId: string;
    code?: string;
  };
  interface SharingPayload {
    images: SerialableImageRecord[];
    snapshot: Snapshot;
    type: SharingType;
    document: HighTexDocument;
  }
  interface Snapshot {
    html: string;
    css: string;
  }
  type SelectionAnchor = {
    offset: number;
    uuid: string;
  };

  type SelectionPayload = {
    start: SelectionAnchor;
    end: SelectionAnchor;
    spanningUUIDs: string[];
    text: string;
  };
  interface InvitationGuest {
    role: SharingGuestRole;
    code: string;
    _code?: string;
  }

  type SharingParticipantRole = SharingGuestRole | "host" | "anonymous";

  interface SharingIdentity {
    id: string;
    name: string;
    role: SharingParticipantRole;
    canComment: boolean;
    invitationCode?: string;
  }

  interface SharingParticipant extends SharingIdentity {
    connected: boolean;
  }

  interface SharingInformation {
    document: Omit<HighTexDocument, "category"> & { category?: Category };
    host: string;
    port: string;
    hostToken: string;
    guest: InvitationGuest[];
    type: SharingType;
    publicInvitation: string;
  }

  type WSMessage<TSender extends Sender = "client"> =
    | CommentMessage<TSender>
    | PingMessage
    | InfoMessage
    | LookUpMessage<TSender>
    | PongMessage
    | ErrorMessage
    | RenameMessage
    | GuestsMessage
    | SharingInfo;

  type Sender = "server" | "client";
  type SharingInfo = {
    type: "sharingInfo";
    payload: {
      document: SharingInformation["document"];
      type: SharingType;
    };
  };
  type InfoMessage = {
    type: "info";
    payload: SharingIdentity;
  };

  type BaseSelectionPayload = SelectionPayload & {
    text: string;
  };

  type CommentServerExtra = {
    role: SharingParticipantRole;
    name?: string;
    participantId?: string;
    invitationCode?: string;
  };

  type CommentServerMessage = BaseSelectionPayload & CommentServerExtra;

  type CommentClientMessage = BaseSelectionPayload;

  type CommentMessage<TSender extends Sender = "client"> = {
    type: "comment";
    payload: TSender extends "server"
      ? CommentServerMessage
      : CommentClientMessage;
  };

  type PingMessage = {
    type: "ping";
    payload: { ts: number };
  };

  type LookUpMessageServer = {
    page: number | string;
    role: SharingParticipantRole;
    name: string;
    participantId?: string;
  };

  type LookUpMessageClient = {
    page: number | string;
  };
  type LookUpMessage<TSender extends Sender = "client"> = {
    type: "lookup";
    payload: TSender extends "server"
      ? LookUpMessageServer
      : LookUpMessageClient;
  };
  type PongMessage = {
    type: "pong";
    payload: {
      ts: number;
    };
  };
  type ErrorMessage = {
    type: "error";
    payload: any;
  };

  type RenameMessage = {
    type: "rename";
    payload: {
      name: string;
    };
  };
  type GuestsMessage = {
    type: "guests";
    payload: {
      guests: SharingParticipant[];
      /**
       * @deprecated use guests
       */
      guest?: SharingParticipant[];
    };
  };
}
