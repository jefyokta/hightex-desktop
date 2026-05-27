export function getBoundingClientRect(element: any): any;
export function getClientRects(element: any): any;
/**
 * Generates a UUID
 * based on: http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript
 * @returns {string} uuid
 */
export function UUID(): string;
/**
 * Find the position of [element] in [nodeList].
 * @param {Element} element to check
 * @param {NodeList} nodeList to find in
 * @returns {int} an index of the match, or -1 if there is no match
 */
export function positionInNodeList(element: Element, nodeList: NodeList): int;
/**
 * Find a unique CSS selector for a given element
 * @param {Element} ele to check
 * @returns {string} a string such that ele.ownerDocument.querySelector(reply) === ele
 * and ele.ownerDocument.querySelectorAll(reply).length === 1
 */
export function findCssSelector(ele: Element): string;
export function attr(element: any, attributes: any): any;
export function querySelectorEscape(value: any, ...args: any[]): string;
/**
 * Creates a new pending promise and provides methods to resolve or reject it.
 * From: https://developer.mozilla.org/en-US/docs/Mozilla/JavaScript_code_modules/Promise.jsm/Deferred#backwards_forwards_compatible
 * @returns {object} defered
 */
export function defer(): object;
export class defer {
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  id: string;
  promise: Promise<any>;
}
export function CSSValueToString(obj: any): any;
export const requestIdleCallback: any;
