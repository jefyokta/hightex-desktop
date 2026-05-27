export default ContentParser;
/**
 * Render a flow of text offscreen
 * @class
 */
declare class ContentParser {
  constructor(content: any, cb: any);
  dom: any;
  parse(markup: any, mime: any): DocumentFragment;
  add(contents: any): any;
  addRefs(content: any): void;
  find(ref: any): any;
  destroy(): void;
  refs: any;
}
