export default BreakToken;
/**
 * BreakToken
 * @class
 */
declare class BreakToken {
  constructor(node: any, offset: any);
  node: HTMLElement;
  offset: any;
  equals(otherBreakToken: BreakToken): boolean;
  toJSON(hash: any): {};
}
