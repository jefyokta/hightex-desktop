export function isElement(node: any): boolean;
export function isText(node: any): boolean;
export function walk(start: any, limiter: any): Generator<any, void, unknown>;
export function nodeAfter(node: any, limiter: any): Node;
export function nodeBefore(node: any, limiter: any): Node;
export function elementAfter(node: any, limiter: any): Node;
export function elementBefore(node: any, limiter: any): Node;
export function displayedElementAfter(node: any, limiter: any): Node;
export function displayedElementBefore(node: any, limiter: any): Node;
export function stackChildren(currentNode: any, stacked: any): any;
export function rebuildAncestors(node: any): DocumentFragment;
export function needsBreakBefore(node: any): boolean;
export function needsBreakAfter(node: any): boolean;
export function needsPreviousBreakAfter(node: any): boolean;
export function needsPageBreak(
  node: any,
  previousSignificantNode: any,
): boolean;
export function words(node: any): Generator<Range, void, unknown>;
export function letters(wordRange: any): Generator<Range, void, unknown>;
export function isContainer(node: any): boolean;
export function cloneNode(n: any, deep?: boolean): any;
export function findElement(node: any, doc: any, forceQuery: any): any;
export function findRef(ref: any, doc: any, forceQuery: any): any;
export function validNode(node: any): boolean;
export function prevValidNode(node: any): any;
export function nextValidNode(node: any): any;
export function indexOf(node: any): any;
export function child(node: any, index: any): any;
export function isVisible(node: any): boolean;
export function hasContent(node: any): boolean;
export function hasTextContent(node: any): boolean;
export function indexOfTextNode(node: any, parent: any): number;
/**
 * Throughout, whitespace is defined as one of the characters
 *  "\t" TAB \u0009
 *  "\n" LF  \u000A
 *  "\r" CR  \u000D
 *  " "  SPC \u0020
 *
 * This does not use Javascript's "\s" because that includes non-breaking
 * spaces (and also some other characters).
 */
/**
 * Determine if a node should be ignored by the iterator functions.
 * taken from https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model/Whitespace#Whitespace_helper_functions
 *
 * @param {Node} node An object implementing the DOM1 |Node| interface.
 * @return {boolean} true if the node is:
 *  1) A |Text| node that is all whitespace
 *  2) A |Comment| node
 *  and otherwise false.
 */
export function isIgnorable(node: Node): boolean;
/**
 * Determine whether a node's text content is entirely whitespace.
 *
 * @param {Node} node  A node implementing the |CharacterData| interface (i.e., a |Text|, |Comment|, or |CDATASection| node
 * @return {boolean} true if all of the text content of |nod| is whitespace, otherwise false.
 */
export function isAllWhitespace(node: Node): boolean;
/**
 * Version of |previousSibling| that skips nodes that are entirely
 * whitespace or comments.  (Normally |previousSibling| is a property
 * of all DOM nodes that gives the sibling node, the node that is
 * a child of the same parent, that occurs immediately before the
 * reference node.)
 *
 * @param {ChildNode} sib  The reference node.
 * @return {Node|null} Either:
 *  1) The closest previous sibling to |sib| that is not ignorable according to |is_ignorable|, or
 *  2) null if no such node exists.
 */
export function previousSignificantNode(sib: ChildNode): Node | null;
export function breakInsideAvoidParentNode(node: any): any;
/**
 * Find a parent with a given node name.
 * @param {Node} node - initial Node
 * @param {string} nodeName - node name (eg. "TD", "TABLE", "STRONG"...)
 * @param {Node} limiter - go up to the parent until there's no more parent or the current node is equals to the limiter
 * @returns {Node|undefined} - Either:
 *  1) The closest parent for a the given node name, or
 *  2) undefined if no such node exists.
 */
export function parentOf(
  node: Node,
  nodeName: string,
  limiter: Node,
): Node | undefined;
/**
 * Version of |nextSibling| that skips nodes that are entirely
 * whitespace or comments.
 *
 * @param {ChildNode} sib  The reference node.
 * @return {Node|null} Either:
 *  1) The closest next sibling to |sib| that is not ignorable according to |is_ignorable|, or
 *  2) null if no such node exists.
 */
export function nextSignificantNode(sib: ChildNode): Node | null;
export function filterTree(content: any, func: any, what: any): void;
