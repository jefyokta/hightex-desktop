export default Splits;
declare class Splits extends Handler {
  afterPageLayout(
    pageElement: any,
    page: any,
    breakToken: any,
    chunker: any,
  ): void;
  handleAlignment(node: any): void;
}
import Handler from "../handler.js";
