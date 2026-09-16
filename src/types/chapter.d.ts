import { Chapter } from "@/editor/chapter";

declare global {
  interface WalkContext {
    graph: ChapterGraphData;
    counter: {
      image: number;
      table: number;
      heading: {
        h1: number;
        h2: number;
        h3: number;
      };
      equation: number;
    };
    chapter: Chapter;
  }

  interface ChapterOptions {
    chapter: string | number;
    documentId: string;
    version?: string;
    isolated?: boolean;
  }
}
export {};
