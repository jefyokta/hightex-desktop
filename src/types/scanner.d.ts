import { JSONContent } from "@tiptap/core";

export {};

declare global {
  type Promisable<T = void> = T | Promise<T>;
  /**
   * @deprecated
   * @since 0.7.5+
   */
  interface ScannerContext {
    chapterId: string;
    index: number;
    path: number[];
    node: JSONContent;
    root: JSONContent | JSONContent[];
    isLastChapter: boolean;
    isEndOfScan: boolean;
  }
  /**
   * @deprecated
   * @since 0.7.5+
   */
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
  /**
   * @deprecated
   * @since 0.7.5+
   */
  interface NodeError {
    chapterId: string;

    name: string;

    id: string;

    description: string;
  }
  /**
   * @deprecated
   * @since 0.7.5+
   */
  type ScannerError = TextError | NodeError;
  /**
   * @deprecated
   * @since 0.7.5+
   */
  interface ParagraphPluginContext {
    text: string;

    scanner: ScannerContext;

    addError: (error: TextError) => void;
  }
  /**
   * @deprecated
   * @since 0.7.5+
   */
  interface NodePluginContext {
    scanner: ScannerContext;

    addError: (error: NodeError) => void;
  }
  /**
   * @deprecated
   * @since 0.7.5+
   */
  interface HightexPlugin {
    id: string;

    version: string;

    scanner?: {
      onParagraph?: (text: string, ctx: ParagraphPluginContext) => Promisable;

      onNode?: (node: JSONContent, ctx: NodePluginContext) => Promisable;
    };
  }
  /**
   * @deprecated
   * @since 0.7.5+
   */
  interface SerialableHightexPlugin {
    id: string;

    version: string;

    scanner?: {
      hasOnParagraph: boolean;

      hasOnNode: boolean;
    };
  }
  /**
   * @deprecated
   * @since 0.7.5+
   */
  interface ScannerResult {
    text: TextError[];

    nodes: NodeError[];
  }
}
