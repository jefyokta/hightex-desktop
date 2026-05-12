import React, {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from "react";

import { Manager } from "@/editor/manager";
import { HighTexDB } from "@/editor/storage/hightex-db";
import { Chapter } from "@/editor/chapter";

type Graph = {
  headings: any[];
  images: any[];
  tables: any[];
};

const emptyGraph: Graph = {
  headings: [],
  images: [],
  tables: [],
};

const GraphContext = createContext<Graph>(emptyGraph);

export const GraphContextProvider: React.FC<PropsWithChildren> = ({
  children,
}) => {
  const [graph, setGraph] = useState<Graph>(emptyGraph);

  const waitChapter = async (): Promise<any> => {
    let chapter = Chapter.instance;

    while (!chapter) {
      await new Promise((r) => setTimeout(r, 10));
      chapter = Chapter.instance;
    }

    return chapter;
  };

  const load = async () => {
    const chapter = await waitChapter();

    const id = chapter.getId();

    const row = await HighTexDB.getInstance().chapterGraphs.get(id);

    if (!row?.data) {
      setGraph(emptyGraph);
      return;
    }

    setGraph({
      headings: (row.data.headings || []).map((h) => ({
        ...h,
        chapterId: id,
      })),
      images: (row.data.images || []).map((i) => ({
        ...i,
        chapterId: id,
      })),
      tables: (row.data.tables || []).map((t) => ({
        ...t,
        chapterId: id,
      })),
    });
  };

  const updateChapter = async (chapterId: string) => {
    const row = await HighTexDB.getInstance().chapterGraphs.get(chapterId);

    const active = Chapter.instance?.getId?.();

    if (chapterId !== active) return;

    if (!row?.data) {
      setGraph(emptyGraph);
      return;
    }

    setGraph({
      headings: (row.data.headings || []).map((h) => ({
        ...h,
        chapterId,
      })),
      images: (row.data.images || []).map((i) => ({
        ...i,
        chapterId,
      })),
      tables: (row.data.tables || []).map((t) => ({
        ...t,
        chapterId,
      })),
    });
  };

  useEffect(() => {
    load();

    const off = Manager.app.on("chapter:update", async ({ chapterId }) => {
      await updateChapter(chapterId);
    });

    return () => off();
  }, []);

  return (
    <GraphContext.Provider value={graph}>{children}</GraphContext.Provider>
  );
};

export const useGraph = () => useContext(GraphContext);
