import { useAppLanguage } from "@/hooks/use-app-language";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { chapterLabel } from "@/editor/chapter/outline";
import { ChapterPicker } from "./chapter-picker";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useChapterNavigation } from "@/hooks/use-editor-navigation";
import { t } from "@/utils/lang";

export const ChapterNavigation = () => {
  useAppLanguage();
  const { chapter, index, previous, following, canBack, canNext, back, next } =
    useChapterNavigation();

  if (!chapter || index < 0) return null;

  const previousLabel = t("editor.chapter_navigation.previous");
  const nextLabel = t("editor.chapter_navigation.next");
  const previousTitle = previous
    ? `${previousLabel}: ${chapterLabel(previous)}`
    : previousLabel;
  const nextTitle = following
    ? `${nextLabel}: ${chapterLabel(following)}`
    : nextLabel;

  return (
    <nav
      data-tour="chapter-navigation"
      aria-label={t("editor.chapter_navigation.label")}
      className="flex shrink-0 items-center"
    >
      <ChapterPicker />
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={!canBack}
              onClick={back}
              aria-label={previousLabel}
              className="text-neutral-500 dark:text-neutral-400"
            >
              <ChevronLeft aria-hidden="true" />
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom">{previousTitle}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={!canNext}
              onClick={next}
              aria-label={nextLabel}
              className="text-neutral-500 dark:text-neutral-400"
            >
              <ChevronRight aria-hidden="true" />
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom">{nextTitle}</TooltipContent>
      </Tooltip>
    </nav>
  );
};
