export const RoleBadge = ({ role }: { role: SharingParticipantRole }) => {
  const ROLE_BADGE: Record<SharingParticipantRole, string> = {
    host: "bg-primary/10 text-primary border-primary/20",
    anonymous: "bg-muted text-muted-foreground border-border",
    leader: "bg-muted text-foreground border-border",
    main_advisor: "bg-muted text-muted-foreground border-border",
    second_advisor: "bg-muted text-muted-foreground border-border",
    member_1: "bg-muted text-muted-foreground border-border",
    member_2: "bg-muted text-muted-foreground border-border",
  };

  const ROLE_LABELS: Record<SharingParticipantRole, string> = {
    host: "Host",
    anonymous: "Anonymous",
    leader: "Leader",
    main_advisor: "Main Advisor",
    second_advisor: "Second Advisor",
    member_1: "Member 1",
    member_2: "Member 2",
  };

  return (
    <span
      className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${ROLE_BADGE[role]}`}
    >
      {ROLE_LABELS[role]}
    </span>
  );
};
