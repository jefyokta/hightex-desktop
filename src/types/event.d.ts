import type { Chapter } from "@/editor/chapter";
import { Document } from "@/editor/document";

declare global {
  interface ChapterUpdateEvent {
    chapterId: string;
  }

  interface GraphUpdateEvent {
    documentId: string;
  }

  interface ChapterCreatedEvent {
    chapter: Chapter;
  }
  interface DocumentWarmedEvent {
    document: Document;
  }

  interface ImageUpdateEvent {
    src:string
  }

  interface AppEvents {
    "chapter:update": ChapterUpdateEvent;
    "chapter:created": ChapterCreatedEvent;
    "document:warmed": DocumentWarmedEvent;
    "image:update":ImageUpdateEvent
  }
}

export {};
