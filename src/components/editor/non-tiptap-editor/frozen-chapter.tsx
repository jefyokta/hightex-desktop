import { AbbrevationList } from "./abbreviation-list";
import { useChapterStore } from "@/hooks/use-chapter";
import { Cv } from "./cv";
import { useRef, useState } from "react";
import { useChapterScroll } from "@/hooks/use-chapter-scroll";

export const FrozenChapter = () => {
  const { chapter } = useChapterStore();
  const [ready, setReady] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  useChapterScroll(chapter?.getId(), ready, contentRef);

  return (
    <div ref={contentRef}>
      {chapter?.getChapter() == "abbrevation" ? (
        <AbbrevationList onReady={setReady} />
      ) : (
        <Cv onReady={setReady} />
      )}
    </div>
  );
};
