export default Chunker;
/**
 * Chop up text into flows
 * @class
 */
declare class Chunker {
  constructor(content: any, renderTo: any, options: any);
  settings: any;
  hooks: {};
  pages: Page[];
  total: number;
  q: Queue;
  stopped: boolean;
  rendered: boolean;
  content: any;
  charsPerBreak: any[];
  setup(renderTo: HTMLElement): void;
  pagesArea: HTMLDivElement;
  pageTemplate: HTMLTemplateElement;
  flow(content: any, renderTo: HTMLElement): Promise<this>;
  source: ContentParser;
  breakToken: BreakToken;
  render(parsed: any, startAt: any): Promise<any>;
  start(): void;
  stop(): void;
  renderOnIdle(renderer: any): Promise<any>;
  renderAsync(renderer: any): Promise<any>;
  handleBreaks(node: any, force: any): Promise<void>;
  layout(
    content: any,
    startAt: any,
  ): AsyncGenerator<any, OverflowContentError, unknown>;
  recoredCharLength(length: any): void;
  maxChars: number;
  removePages(fromIndex?: number): void;
  addPage(blank: any): Page;
  clonePage(originalPage: Page): Promise<void>;
  loadFonts(): Promise<void | any[]>;
  destroy(): void;
}
import Queue from "../utils/queue.js";
import ContentParser from "./parser.js";
import { OverflowContentError } from "./renderresult.js";
import Page from "./page.js";
import BreakToken from "./breaktoken.js";
