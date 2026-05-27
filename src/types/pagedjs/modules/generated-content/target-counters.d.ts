export default TargetCounters;
declare class TargetCounters extends Handler {
  styleSheet: any;
  counterTargets: {};
  onContent(
    funcNode: any,
    fItem: any,
    fList: any,
    declaration: any,
    rule: any,
  ): void;
  afterPageLayout(
    fragment: any,
    page: Page,
    breakToken: BreakToken,
    chunker: Chunker,
  ): void;
}
import BreakToken from "../../chunker/breaktoken.js";
import Chunker from "../../chunker/chunker.js";
import Page from "../../chunker/page.js";
import Handler from "../handler.js";
