export default TargetText;
declare class TargetText extends Handler {
  styleSheet: any;
  textTargets: {};
  beforeContent: string;
  afterContent: string;
  selector: {};
  onContent(
    funcNode: any,
    fItem: any,
    fList: any,
    declaration: any,
    rule: any,
  ): void;
  onPseudoSelector(
    pseudoNode: any,
    pItem: any,
    pList: any,
    selector: any,
    rule: any,
  ): void;
  afterParsed(fragment: any): void;
}
import Handler from "../handler.js";
