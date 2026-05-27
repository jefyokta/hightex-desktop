export default PositionFixed;
declare class PositionFixed extends Handler {
  styleSheet: any;
  fixedElementsSelector: any[];
  fixedElements: any[];
  onDeclaration(declaration: any, dItem: any, dList: any, rule: any): void;
  afterParsed(fragment: any): void;
  afterPageLayout(pageElement: any, page: any, breakToken: any): void;
}
import Handler from "../handler.js";
