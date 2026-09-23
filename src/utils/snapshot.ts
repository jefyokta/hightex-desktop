import { t } from "./lang";

export const getSnapshotLabel = (type:SharingType)=>{
    switch (type) {
        case  "advising":
            return t("sharing.advising")
        case "finalDefense":
            return t("sharing.final_defense");
        case "proposalSeminar":
            return t("sharing.proposal_seminar")
        default:
            return t("sharing.advising")
    }
}