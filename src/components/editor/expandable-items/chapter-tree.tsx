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
import { t } from "@/utils/lang";

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
      <TabHeader
        title="Chapters"
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
  const nav = useNavigate();
  const [headings, setHeadings] = useState<HeadingGraph[]>(
    chapter.graph?.data?.headings || [],
  );

  useEffect(() => {
    const off = Manager.app.on("chapter:update", async ({ chapterId }) => {
      if (chapterId !== chapter.getId()) return;

      const data = await chapter.graph?.sync();
      setHeadings([...(data?.headings || [])]);
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
            ? `${chapter.getChapter()}. ${chapter.title || ""}`
            : (chapter.title || "").toUpperCase()}
        </span>
      </FolderTrigger>

      <FolderContent>
        <SubFiles>
          {tree.map((node) => (
            <TreeNode key={node.id || `tree-${node.numbering}`} node={node} />
          ))}
        </SubFiles>
      </FolderContent>
    </FolderItem>
  );
};

type Tree = HeadingGraph & { children: Tree[] };

const TreeNode = ({ node }: { node: Tree }) => {
  const hasChildren = (node.children?.length ?? 0) > 0;
  const { setParams } = useParams();
  const nav = useNavigate();

  const handleClick = (_: React.MouseEvent) => {
    if (node.chapterId == Document.current?.getId()) {
      if (node.id) Manager.scrollTo(node.id);
      return;
    }
    if (node.id) setParams([node.id]);
    const target = "/document/" + (node.chapterId || "").replace(".", "/");
    nav(target);
  };

  const isAttachmentH1 =
    (node.chapterId?.includes(".attachment") ||
      node.chapterId?.split?.(".")?.[1] === "attachment") &&
    node.level === 1;

  const numbering = isAttachmentH1
    ? `LAMPIRAN ${Counter.getAlpha(Number(node.numbering) || 1)}`
    : (node.numbering ?? "");

  const nodeId = node.id || `node-${numbering}-${node.level}`;

  if (!hasChildren) {
    return (
      <div onClick={handleClick} className="cursor-pointer text-xs!">
        <FileItem>
          <div className="flex gap-2 truncate">
            {numbering ? <span>{numbering}</span> : null}
            <TextRenderer texts={node.text || []} />
          </div>
        </FileItem>
      </div>
    );
  }

  return (
    <div onClick={handleClick} className="cursor-pointer text-xs!">
      <FolderItem value={nodeId}>
        <FolderTrigger onClick={(e) => e.stopPropagation()}>
          <div className="flex gap-2 truncate">
            {numbering ? <span>{numbering}</span> : null}
            <TextRenderer texts={node.text || []} />
          </div>
        </FolderTrigger>

        <FolderContent>
          <SubFiles>
            {node.children.map((child: any) => (
              <TreeNode key={child.id || `child-${Math.random()}`} node={child} />
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

  for (const item of list || []) {
    if (!item) continue;
    const node = { ...item, level: item.level || 1, children: [] };

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
