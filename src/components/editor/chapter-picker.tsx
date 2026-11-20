import { useEffect, useState } from "react";
import { BookOpen, CornerDownLeft, FileText, ListTree } from "lucide-react";
import type { Chapter } from "@/editor/chapter";
import {
  chapterLabel,
  headingNumber,
  outlineText,
  type ChapterOutlineNode,
} from "@/editor/chapter/outline";
import { useChapterOutline } from "@/hooks/use-chapter-outline";
import { useChapterNavigation } from "@/hooks/use-editor-navigation";
import { useAppLanguage } from "@/hooks/use-app-language";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { TextRenderer } from "./text-renderer";
import { t } from "@/utils/lang";
import { isMac } from "@/utils/is-mac";
import "@/css/chapter-picker.css";

type PickChapter = (chapter: Chapter, heading?: HeadingGraph) => void;

type HeadingItemsProps = {
  nodes: ChapterOutlineNode[];
  chapter: Chapter;
  onPick: PickChapter;
  depth?: number;
};

function HeadingItems({ nodes, chapter, onPick, depth = 1 }: HeadingItemsProps) {
  return nodes.map(node => (
    <HeadingItem key={node.id} node={node} chapter={chapter} onPick={onPick} depth={depth} />
  ));
}

function HeadingItem({ node, chapter, onPick, depth }: {
  node: ChapterOutlineNode;
  chapter: Chapter;
  onPick: PickChapter;
  depth: number;
}) {
  return (
    <>
      <CommandItem
        value={`${chapter.getId()}:${node.id}`}
        keywords={[outlineText(node.text), headingNumber(node), chapterLabel(chapter)]}
        onSelect={() => onPick(chapter, node)}
        style={{ paddingInlineStart: 14 + depth * 18 }}
        className="chapter-picker-heading"
      >
        <span className="chapter-picker-number">{headingNumber(node)}</span>
        <span className="min-w-0 truncate"><TextRenderer texts={node.text} /></span>
      </CommandItem>
      <HeadingItems nodes={node.children} chapter={chapter} onPick={onPick} depth={depth + 1} />
    </>
  );
}

function ChapterItems({ chapter, active, onPick }: {
  chapter: Chapter;
  active: boolean;
  onPick: PickChapter;
}) {
  const nodes = useChapterOutline(chapter);
  return (
    <CommandGroup>
      <CommandItem
        value={chapter.getId()}
        keywords={[chapterLabel(chapter)]}
        data-checked={active}
        onSelect={() => onPick(chapter)}
        className="chapter-picker-chapter"
      >
        <FileText className="size-4 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate font-medium">{chapterLabel(chapter)}</span>
        {active && (
          <span className="chapter-picker-current">{t("editor.chapter_navigation.current")}</span>
        )}
      </CommandItem>
      <HeadingItems nodes={nodes} chapter={chapter} onPick={onPick} />
    </CommandGroup>
  );
}

export function ChapterPicker() {
  useAppLanguage();
  const [open, setOpen] = useState(false);
  const { chapter, chapters, goTo, goToHeading } = useChapterNavigation();

  useEffect(() => {
    if (!chapter) return;
    const handleKey = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented || event.isComposing || event.repeat ||
        event.altKey || event.shiftKey || !(event.metaKey || event.ctrlKey) ||
        event.key.toLowerCase() !== "k"
      ) return;
      // An existing form dialog keeps ownership of its keyboard shortcuts.
      if (!open && document.querySelector(
        '[role="dialog"][data-state="open"], [role="dialog"][data-open]',
      )) return;
      event.preventDefault();
      setOpen(value => !value);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [chapter, open]);

  const pick: PickChapter = (target, heading) => {
    setOpen(false);
    // Allow the dialog focus scope to close before scrolling the document.
    requestAnimationFrame(() => heading ? goToHeading(target, heading) : goTo(target));
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        disabled={!chapter}
        onClick={() => setOpen(true)}
        data-chapter-picker-trigger
        aria-keyshortcuts="Meta+K Control+K"
        className="gap-2 text-muted-foreground"
        title={t("editor.chapter_navigation.open")}
      >
        <ListTree className="size-4" />
        <span className="hidden max-w-36 truncate lg:inline">
          {chapter ? chapterLabel(chapter) : t("editor.chapter_navigation.label")}
        </span>
        <kbd className="chapter-picker-shortcut">{isMac ? "⌘ K" : "Ctrl K"}</kbd>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="chapter-picker-dialog" showCloseButton={false} data-chapter-picker>
          <div className="chapter-picker-header">
            <span className="chapter-picker-icon"><BookOpen className="size-5" /></span>
            <div className="min-w-0 flex-1">
              <DialogTitle>{t("editor.chapter_navigation.open")}</DialogTitle>
              <DialogDescription>{t("editor.chapter_navigation.description")}</DialogDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)} aria-label={t("common.close")}>
              <kbd className="chapter-picker-shortcut">Esc</kbd>
            </Button>
          </div>
          {open && (
            <Command className="chapter-picker-command" defaultValue={chapter?.getId()}>
              <CommandInput placeholder={t("editor.chapter_navigation.search")} autoFocus />
              <CommandList className="chapter-picker-list">
                <CommandEmpty>{t("editor.chapter_navigation.empty")}</CommandEmpty>
                {chapters.map(item => (
                  <ChapterItems
                    key={item.getId()}
                    chapter={item}
                    active={item.getId() === chapter?.getId()}
                    onPick={pick}
                  />
                ))}
              </CommandList>
            </Command>
          )}
          <div className="chapter-picker-footer">
            <span>↑ ↓ <span>{t("editor.chapter_navigation.browse")}</span></span>
            <span><CornerDownLeft className="size-3" /> {t("editor.chapter_navigation.select")}</span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
