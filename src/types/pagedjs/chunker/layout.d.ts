export default Layout;
/**
 * Layout
 * @class
 */
declare class Layout {
  constructor(element: any, hooks: any, options: any);
  element: HTMLElement;
  bounds: any;
  parentBounds: any;
  gap: number;
  hooks: any;
  settings: any;
  maxChars: number;
  forceRenderBreak: boolean;
  renderTo(
    wrapper: HTMLElement,
    source: any,
    breakToken: BreakToken,
    bounds?: any,
  ): Promise<RenderResult>;
  breakAt(node: any, offset?: number): BreakToken;
  shouldBreak(node: any, limiter: any): boolean;
  forceBreak(): void;
  getStart(source: any, breakToken: any): any;
  append(
    node: any,
    dest: any,
    breakToken: HTMLElement,
    shallow?: boolean,
    rebuild?: boolean,
  ): any;
  rebuildTableFromBreakToken(breakToken: any, dest: any): void;
  waitForImages(imgs: any): Promise<void>;
  awaitImageLoaded(image: any): Promise<any>;
  avoidBreakInside(node: any, limiter: any): any;
  createBreakToken(overflow: any, rendered: any, source: any): BreakToken;
  findBreakToken(
    rendered: any,
    source: any,
    bounds: any,
    prevBreakToken: any,
    extract?: boolean,
  ): BreakToken;
  hasOverflow(element: any, bounds?: any): boolean;
  findOverflow(rendered: any, bounds?: any, gap?: number): Range;
  findEndToken(rendered: any, source: any): BreakToken;
  textBreak(node: any, start: any, end: any, vStart: any, vEnd: any): number;
  removeOverflow(overflow: any, breakLetter: any): any;
  hyphenateAtBreak(startContainer: any, breakLetter: any): void;
  equalTokens(a: any, b: any): boolean;
}
import RenderResult from "./renderresult.js";
import BreakToken from "./breaktoken.js";
