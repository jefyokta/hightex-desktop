import { AbbrevationList } from "./abbreviation-list"
import { useChapterStore } from "@/hooks/use-chapter"
import { Cv } from "./cv"

export const FrozenChapter = () => {

    const { chapter } = useChapterStore()



    return <>{chapter?.getChapter() == "abbrevation" ? <AbbrevationList /> : <Cv/>}</>
}