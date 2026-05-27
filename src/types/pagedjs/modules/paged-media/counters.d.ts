export default Counters;
declare class Counters extends Handler {
  styleSheet: any;
  counters: {};
  resetCountersMap: Map<any, any>;
  onDeclaration(declaration: any, dItem: any, dList: any, rule: any): void;
  afterParsed(parsed: any): void;
  addCounter(name: any): any;
  handleIncrement(declaration: any, rule: any): any[];
  handleReset(declaration: any, rule: any): void;
  processCounters(parsed: any, counters: any): void;
  scopeCounters(counters: any): void;
  insertRule(rule: any): void;
  processCounterIncrements(parsed: any, counter: any): void;
  processCounterResets(parsed: any, counter: any): void;
  addCounterValues(parsed: any, counter: any): void;
  addFootnoteMarkerCounter(list: any): void;
  incrementCounterForElement(element: any, incrementArray: any): void;
  /**
   * Merge multiple values of a counter-increment CSS rule, using the specified operator.
   *
   * @param {Array} incrementArray the values to merge, e.g. ['c1 1', 'c1 -7 c2 1']
   * @param {Function} operator the function used to merge counter values (e.g. keep the last value of a counter or sum
   *					the counter values)
   * @return {string} the merged value of the counter-increment CSS rule
   */
  mergeIncrements(incrementArray: any[], operator: Function): string;
  afterPageLayout(pageElement: any, page: any): void;
}
import Handler from "../handler.js";
