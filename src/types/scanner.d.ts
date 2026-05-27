import { JSONContent } from "@tiptap/core";

export {};

declare global {
  type Promisable<T = void> = T | Promise<T>;

  interface ScannerContext {
    chapterId: string;

    index: number;

    path: number[];

    node: JSONContent;

    root: JSONContent | JSONContent[];
    isLastChapter: boolean;
    isEndOfScan: boolean;
  }

  interface TextError {
    chapterId: string;

    name: string;

    title: string;

    description: string;

    text: string;

    match: RegExp;

    range?: {
      start: number;
      end: number;
    };
  }

  interface NodeError {
    chapterId: string;

    name: string;

    id: string;

    description: string;
  }

  type ScannerError = TextError | NodeError;

  interface ParagraphPluginContext {
    text: string;

    scanner: ScannerContext;

    addError: (error: TextError) => void;
  }

  interface NodePluginContext {
    scanner: ScannerContext;

    addError: (error: NodeError) => void;
  }

  interface HightexPlugin {
    id: string;

    version: string;

    scanner?: {
      onParagraph?: (text: string, ctx: ParagraphPluginContext) => Promisable;

      onNode?: (node: JSONContent, ctx: NodePluginContext) => Promisable;
    };
  }

  interface SerialableHightexPlugin {
    id: string;

    version: string;

    scanner?: {
      hasOnParagraph: boolean;

      hasOnNode: boolean;
    };
  }

  interface ScannerResult {
    text: TextError[];

    nodes: NodeError[];
  }
}
