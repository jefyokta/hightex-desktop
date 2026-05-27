export default RunningHeaders;
declare class RunningHeaders extends Handler {
  runningSelectors: {};
  elements: {};
  onDeclaration(declaration: any, dItem: any, dList: any, rule: any): void;
  afterParsed(fragment: any): void;
  afterPageLayout(fragment: any): void;
  orderedSelectors: any[];
  /**
   * Assign a weight to @page selector classes
   * 1) page
   * 2) left & right
   * 3) blank
   * 4) first & nth
   * 5) named page
   * 6) named left & right
   * 7) named first & nth
   * @param {string} [s] selector string
   * @return {int} weight
   */
  pageWeight(s?: string): int;
  /**
   * Orders the selectors based on weight
   *
   * Does not try to deduplicate base on specifity of the selector
   * Previous matched selector will just be overwritten
   * @param {obj} [obj] selectors object
   * @return {Array} orderedSelectors
   */
  orderSelectors(obj?: any): any[];
  beforeTreeParse(text: any, sheet: any): void;
}
import Handler from "../handler.js";
