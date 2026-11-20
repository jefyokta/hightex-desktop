import { useEffect, useState } from "react";
import { Document } from "@/editor/document";
import { Manager } from "@/editor/manager";

import {
  Files,
  FolderContent,
  FolderItem,
  FolderTrigger,
  SubFiles,
  FileItem,
} from "../../animate-ui/components/radix/files";
import { TextRenderer } from "../text-renderer";
import { Chapter } from "@/editor/chapter";
import { useChapterOutline } from "@/hooks/use-chapter-outline";
import { useChapterNavigation } from "@/hooks/use-editor-navigation";
import { chapterLabel, headingNumber, type ChapterOutlineNode } from "@/editor/chapter/outline";
import { TabHeader } from "./components/tab-header";
import { t } from "@/utils/lang";

export const ChapterTree = () => {
  const [doc, setDoc] = useState<Document | undefined>(Document.instance);

  useEffect(() => {
    const off = Manager.app.on("document:warmed", ({ document }) => {
      setDoc(document);
    });

    return () => off();
  }, []);

  return (
    <div
      data-tour="editor-chapter-list"
      className="w-full h-full overflow-auto "
    >
      <TabHeader
        title={t("editor.inline.chapters_title")}
        desc={t("editor.expandable.chapters.header")}
      />
      <Files>
        {doc?.chapters.map((chapter) => (
          <ChapterNode key={chapter.getId()} chapter={chapter} />
        ))}
      </Files>
    </div>
  );
};

const ChapterNode = ({ chapter }: { chapter: Chapter }) => {
  const { goTo } = useChapterNavigation();
  const tree = useChapterOutline(chapter);

  return (
    <FolderItem
      value={chapter.getId()}
      onClick={() => goTo(chapter)}
    >
      <FolderTrigger>
        <span
          data-tour={
            chapter.getChapter() === "attachment"
              ? "editor-chapter-appendix"
              : undefined
          }
          className="text-xs truncate!"
        >
          {chapterLabel(chapter)}
        </span>
      </FolderTrigger>

      <FolderContent>
        <SubFiles>
          {tree.map((node) => (
            <TreeNode key={node.id} node={node} chapter={chapter} />
          ))}
        </SubFiles>
      </FolderContent>
    </FolderItem>
  );
};

const TreeNode = ({ node, chapter }: { node: ChapterOutlineNode; chapter: Chapter }) => {
  const hasChildren = node.children.length > 0;
  const { goToHeading } = useChapterNavigation();
  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    goToHeading(chapter, node);
  };

  if (!hasChildren) {
    return (
      <div onClick={handleClick} className="cursor-pointer text-xs!">
        <FileItem>
          <div className="flex gap-2 truncate">
            <span>{headingNumber(node)}</span>
            <TextRenderer texts={node.text} />
          </div>
        </FileItem>
      </div>
    );
  }

  return (
    <div onClick={handleClick} className="cursor-pointer text-xs!">
      <FolderItem value={node.id}>
        <FolderTrigger onClick={(e) => e.stopPropagation()}>
          <div className="flex gap-2 truncate">
            <span>{headingNumber(node)}</span>
            <TextRenderer texts={node.text} />
          </div>
        </FolderTrigger>

        <FolderContent>
          <SubFiles>
            {node.children.map((child) => (
              <TreeNode key={child.id} node={child} chapter={chapter} />
            ))}
          </SubFiles>
        </FolderContent>
      </FolderItem>
    </div>
  );
};
