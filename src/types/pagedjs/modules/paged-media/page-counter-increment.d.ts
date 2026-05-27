export default PageCounterIncrement;
declare class PageCounterIncrement extends Handler {
  styleSheet: any;
  pageCounter: {
    name: string;
    increments: {};
    resets: {};
  };
  onDeclaration(declaration: any, dItem: any, dList: any, rule: any): void;
  afterParsed(_: any): void;
  handleIncrement(
    declaration: any,
    rule: any,
  ): {
    selector: any;
    number: any;
  };
  insertRule(rule: any): void;
}
import Handler from "../handler.js";
