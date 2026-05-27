import { Chapter } from "@/editor/chapter";

declare global {
  interface Graph {
    id: string;
    text: any[];
    pos: number;
    chapterId: string;
    numbering: string;
  }
  interface HeadingGraph extends Graph {
    level: number;
  }

  interface ImageGraph extends Graph {
    imgSrc: string;
  }

  interface TableGraph extends Graph {}
  interface ChapterGraphData {
    headings: HeadingGraph[];
    images: ImageGraph[];
    tables: TableGraph[];
  }
}

export {};
