import type { Chapter } from "@/editor/chapter";
import { Document } from "@/editor/document";
import { JSONContent } from "@tiptap/core";

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
  interface VarUpdated {
    name: string;
    value: string;
  }
  interface MigratingDeprecation {
    fixed:number,
    node:JSONContent,
    id:string
  }
  interface AppEvents {
    "chapter:update": ChapterUpdateEvent;
    "chapter:created": ChapterCreatedEvent;
    "document:warmed": DocumentWarmedEvent;
    "image:update": ImageUpdateEvent;
    //editor type bounching
    "chapter:commit": ChapterCommitEvent;
    "document:updated": DocumentUpdatedEvent;
    "var:updated": VarUpdated;
    "migrating:deprecation":MigratingDeprecation
  }
}

export {};
