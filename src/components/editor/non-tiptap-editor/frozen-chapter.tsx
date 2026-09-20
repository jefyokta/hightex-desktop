import { AbbrevationList } from "./abbreviation-list"
import { useChapterStore } from "@/hooks/use-chapter"

export const FrozenChapter = () => {

    const { chapter } = useChapterStore()



    return <>{chapter?.getChapter() == "abbrevation" ? <AbbrevationList /> : <></>}</>
}