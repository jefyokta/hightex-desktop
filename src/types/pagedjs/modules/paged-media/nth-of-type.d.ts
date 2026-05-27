export default NthOfType;
declare class NthOfType extends Handler {
  styleSheet: any;
  selectors: {};
  onRule(ruleNode: any, ruleItem: any, rulelist: any): void;
  afterParsed(parsed: any): void;
  processSelectors(parsed: any, selectors: any): void;
}
import Handler from "../handler.js";
