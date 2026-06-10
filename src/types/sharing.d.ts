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

  interface SharingPayload {
    images: SerialableImageRecord[];
    snapshot: Snapshot
    type: SharingType;
    document: HighTexDocument;
  }
  interface Snapshot {
    html:string,css:string
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
  }
  interface SharingInformation {
    document: Omit<HighTexDocument, "category"> & { category?: Category };
    host: string;
    port: string;
    guest: InvitationGuest[];
    type: SharingType;
  }
  type WSMessage = CommentMessage | PingMessage| InfoMessage |LookUpMessage;
  type InfoMessage ={
    type:"info",
    payload:{role:string}

}

  type CommentMessage = {
      type: "comment";
      payload: SelectionData | SelectionData & {role:SharingGuestRole};
    }

  type PingMessage= {
      type: "ping";
      payload: { ts: number };
    }
  type LookUpMessage = {
    type:"lookup",
    payload:{
      page:number|string,
      role?:string,
    }
  }
}
