export default Page;
/**
 * Render a page
 * @class
 */
declare class Page {
  constructor(
    pagesArea: any,
    pageTemplate: any,
    blank: any,
    hooks: any,
    options: any,
  );
  pagesArea: any;
  pageTemplate: any;
  blank: any;
  width: number;
  height: number;
  hooks: any;
  settings: any;
  create(template: any, after: any): any;
  element: HTMLDivElement;
  pagebox: any;
  area: any;
  footnotesArea: any;
  createWrapper(): HTMLDivElement;
  wrapper: HTMLDivElement;
  index(pgnum: any): void;
  position: number;
  id: string;
  layout(contents: any, breakToken: HTMLElement, maxChars: any): Promise<any>;
  startToken: any;
  layoutMethod: Layout;
  endToken: any;
  append(contents: any, breakToken: any): Promise<any>;
  getByParent(ref: any, entries: any): any;
  onOverflow(func: any): void;
  _onOverflow: any;
  onUnderflow(func: any): void;
  _onUnderflow: any;
  clear(): void;
  addListeners(contents: any): boolean;
  _checkOverflowAfterResize: any;
  _onScroll: any;
  listening: boolean;
  removeListeners(): void;
  addResizeObserver(contents: any): void;
  ro: ResizeObserver;
  checkOverflowAfterResize(contents: any): void;
  checkUnderflowAfterResize(contents: any): void;
  destroy(): void;
}
import Layout from "./layout.js";
