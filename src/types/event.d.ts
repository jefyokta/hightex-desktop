import type { Chapter } from "@/editor/chapter";
import { Document } from "@/editor/document";

declare global {
  interface ChapterUpdateEvent extends ChapterEvent {
    chapterId: string;
  }
  interface ChapterEvent {
    chapter: Chapter;
  }

  interface ChapterCreatedEvent extends ChapterEvent {}
  interface DocumentWarmedEvent {
    document: Document;
  }

  interface ImageUpdateEvent {
    src: string;
  }
  interface DocumentUpdatedEvent {
    document: HighTexDocument;
  }
  interface ChapterCommitEvent extends ChapterEvent {}

  interface AppEvents {
    "chapter:update": ChapterUpdateEvent;
    "chapter:created": ChapterCreatedEvent;
    "document:warmed": DocumentWarmedEvent;
    "image:update": ImageUpdateEvent;
    "chapter:commit": ChapterCommitEvent;
    "document:updated": DocumentUpdatedEvent;
  }
}

export {};
