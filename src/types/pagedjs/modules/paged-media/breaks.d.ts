export default Breaks;
declare class Breaks extends Handler {
  breaks: {};
  onDeclaration(declaration: any, dItem: any, dList: any, rule: any): void;
  afterParsed(parsed: any): void;
  processBreaks(parsed: any, breaks: any): void;
  mergeBreaks(pageBreaks: any, newBreaks: any): any;
  addBreakAttributes(pageElement: any, page: any): void;
  afterPageLayout(pageElement: any, page: any): void;
}
import Handler from "../handler.js";
