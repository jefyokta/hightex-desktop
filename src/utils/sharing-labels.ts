import { t, type LocaleKey } from "@/utils/lang";

const SESSION_LABELS: Record<SharingType, LocaleKey> = {
  advising: "present.type_advising",
  proposalSeminar: "present.type_proposal_seminar",
  finalDefense: "present.type_final_defense",
};
export function sharingTypeLabel(type: SharingType): string {
  return type in SESSION_LABELS ? t(SESSION_LABELS[type]) : type;
}
