import { useEffect, useMemo, useState } from "react";
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
import { useNavigate } from "react-router-dom";
import { useParams } from "@/hooks/use-params";
import { Counter } from "tjsn-parser";
import { TabHeader } from "./components/tab-header";

export const ChapteTree = () => {
  const [doc, setDoc] = useState<Document | undefined>(Document.instance);

  useEffect(() => {
    const off = Manager.app.on("document:warmed", ({ document }) => {
      setDoc(document);
    });

    return () => off();
  }, []);

  return (
    <div className="w-full h-full overflow-auto ">
      <TabHeader title="Chapters" desc="List of chapters in this document" />
      <Files>
        {doc?.chapters.map((chapter) => (
          <ChapterNode key={chapter.getId()} chapter={chapter} />
        ))}
      </Files>
    </div>
  );
};

const ChapterNode = ({ chapter }: { chapter: Chapter }) => {
  const nav = useNavigate();
  const [headings, setHeadings] = useState<HeadingGraph[]>(
    chapter.graph.data.headings || [],
  );

  useEffect(() => {
    const off = Manager.app.on("chapter:update", async ({ chapterId }) => {
      if (chapterId !== chapter.getId()) return;

      const data = await chapter.graph.sync();
      setHeadings([...(data.headings || [])]);
    });

    return () => off();
  }, [chapter]);

  const tree = useMemo(() => buildTree(headings || []), [headings]);

  return (
    <FolderItem
      value={chapter.getId()}
      onClick={() => {
        if (chapter.getId() == Document.current?.getId()) {
          return;
        }
        nav(chapter.query.url());
      }}
    >
      <FolderTrigger>
        <span className="text-xs truncate!">
          {chapter.query.isNormalChapter()
            ? `${chapter.getChapter()}. ${chapter.title}`
            : chapter.title.toUpperCase()}
        </span>
      </FolderTrigger>

      <FolderContent>
        <SubFiles>
          {tree.map((node) => (
            <TreeNode key={node.id} node={node} />
          ))}
        </SubFiles>
      </FolderContent>
    </FolderItem>
  );
};

type Tree = HeadingGraph & { children: Tree[] };

const TreeNode = ({ node }: { node: Tree }) => {
  const hasChildren = node.children?.length > 0;
  const { setParams } = useParams();
  const nav = useNavigate();

  const handleClick = (_: React.MouseEvent) => {
    if (node.chapterId == Document.current?.getId()) {
      Manager.scrollTo(node.id);
      return;
    }
    setParams([node.id]);
    const target = "/document/" + node.chapterId.replace(".", "/");
    nav(target);
  };

  if (!hasChildren) {
    const numbering =
      node.chapterId.split(".")[1] == "attachment" && node.level == 1
        ? `LAMPIRAN ${Counter.getAlpha(Number(node.numbering))}`
        : node.numbering;
    return (
      <div onClick={handleClick} className="cursor-pointer text-xs!">
        <FileItem>
          <div className="flex gap-2 truncate">
            <span>{numbering}</span>
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
            <span>{node.numbering}</span>
            <TextRenderer texts={node.text} />
          </div>
        </FolderTrigger>

        <FolderContent>
          <SubFiles>
            {node.children.map((child: any) => (
              <TreeNode key={child.id} node={child} />
            ))}
          </SubFiles>
        </FolderContent>
      </FolderItem>
    </div>
  );
};

const buildTree = (list: HeadingGraph[]) => {
  const root: any[] = [];
  const stack: any[] = [];

  for (const item of list) {
    const node = { ...item, children: [] };

    while (stack.length && stack[stack.length - 1].level >= node.level) {
      stack.pop();
    }

    if (!stack.length) {
      root.push(node);
    } else {
      stack[stack.length - 1].children.push(node);
    }

    stack.push(node);
  }

  return root;
};
