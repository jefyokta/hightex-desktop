const SESSION_LABELS: Record<SharingType, string> = {
  advising: "Advising",
  proposalSeminar: "Proposal Seminar",
  finalDefense: "Final Defense",
};
export function sharingTypeLabel(type: SharingType): string {
  return SESSION_LABELS[type] ?? type;
}
