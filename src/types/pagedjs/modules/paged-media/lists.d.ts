export default Lists;
declare class Lists extends Handler {
  afterParsed(content: any): void;
  afterPageLayout(
    pageElement: any,
    page: any,
    breakToken: any,
    chunker: any,
  ): void;
  addDataNumbers(list: any): void;
}
import Handler from "../handler.js";
