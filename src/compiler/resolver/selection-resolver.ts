type SelectionData = null | SelectionPayload;

export class SelectionResolver {
  private static _instance: SelectionResolver | null = null;
  public selectionData: SelectionData = null;

  static get instance() {
    return this._instance;
  }

  constructor() {
    SelectionResolver._instance = this;
  }

  private listener?: () => void;
  private wrapper?: Element;

  async resolve(): Promise<void> {
    if (this.listener) return;

    this.wrapper = document.body;

    this.listener = () => this.handleSelectionChange();

    document.addEventListener("mouseup", this.listener);
  }

  destroy(): void {
    if (!this.listener) return;
    document.removeEventListener("mouseup", this.listener);
    this.listener = undefined;
    this.selectionData = null;
  }

  private handleSelectionChange(): void {
    this.selectionData = null;

    const selection = document.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed)
      return;

    const range = selection.getRangeAt(0);
    if (!this.wrapper) return;

    if (!this.wrapper.contains(range.commonAncestorContainer)) return;

    const { startContainer, startOffset, endContainer, endOffset } = range;

    const startUUIDEl = this.getClosestUUIDElement(startContainer);
    const endUUIDEl = this.getClosestUUIDElement(endContainer);

    if (!startUUIDEl || !endUUIDEl) return;

    const startUUID = this.getCanonicalUUID(startUUIDEl);
    const endUUID = this.getCanonicalUUID(endUUIDEl);

    if (!startUUID || !endUUID) return;

    const logicalStartOffset = this.getLogicalOffset(
      startUUIDEl,
      startContainer,
      startOffset,
    );
    const logicalEndOffset = this.getLogicalOffset(
      endUUIDEl,
      endContainer,
      endOffset,
    );

    const spanningUUIDs = this.getSpanningUUIDs(range);

    this.selectionData = {
      start: { uuid: startUUID, offset: logicalStartOffset },
      end: { uuid: endUUID, offset: logicalEndOffset },
      spanningUUIDs,
      text: range.toString(),
    };
    console.log(this.selectionData);
  }

  private getClosestUUIDElement(node: Node): HTMLElement | null {
    const el = node instanceof Element ? node : node.parentElement;
    if (!el) return null;
    return (
      el.closest<HTMLElement>("[data-uuid]") ??
      el.closest<HTMLElement>("[data-split-from]")
    );
  }
  private getCanonicalUUID(el: HTMLElement): string | null {
    return el.getAttribute("data-uuid");
  }

  private getLogicalOffset(
    fragmentEl: HTMLElement,
    targetNode: Node,
    domOffset: number,
  ): number {
    const canonicalUUID = this.getCanonicalUUID(fragmentEl);
    if (!canonicalUUID || !this.wrapper) return 0;

    const allFragments = this.getAllFragments(canonicalUUID);

    let charsBefore = 0;
    for (const frag of allFragments) {
      if (frag === fragmentEl) break;
      charsBefore += frag.textContent?.length ?? 0;
    }

    const offsetInFragment = this.getCharOffsetInElement(
      fragmentEl,
      targetNode,
      domOffset,
    );

    return charsBefore + offsetInFragment;
  }

  private getAllFragments(uuid: string): HTMLElement[] {
    if (!this.wrapper) return [];

    const fragments = [
      ...this.wrapper.querySelectorAll<HTMLElement>(`[data-uuid="${uuid}"]`),
    ];

    return fragments.sort((a, b) =>
      a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
    );
  }

  private getCharOffsetInElement(
    rootEl: Element,
    targetNode: Node,
    domOffset: number,
  ): number {
    if (targetNode.nodeType === Node.TEXT_NODE) {
      let offset = 0;
      const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT);
      let node: Node | null;

      while ((node = walker.nextNode())) {
        if (node === targetNode) {
          return offset + domOffset;
        }
        offset += node.textContent?.length ?? 0;
      }
      return offset;
    }

    let offset = 0;
    const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT);
    let node: Node | null;

    const targetChild = targetNode.childNodes[domOffset];

    while ((node = walker.nextNode())) {
      if (targetChild && (node === targetChild || targetChild.contains(node))) {
        break;
      }
      offset += node.textContent?.length ?? 0;
    }

    return offset;
  }

  private getSpanningUUIDs(range: Range): string[] {
    if (!this.wrapper) return [];

    const uuids: string[] = [];
    const seen = new Set<string>();

    const candidates = this.wrapper.querySelectorAll<HTMLElement>(
      "[data-uuid], [data-split-from]",
    );

    for (const el of candidates) {
      if (!this.elementOverlapsRange(el, range)) continue;

      const uuid = this.getCanonicalUUID(el);
      if (!uuid || seen.has(uuid)) continue;

      seen.add(uuid);
      uuids.push(uuid);
    }

    return uuids;
  }

  private elementOverlapsRange(el: Element, range: Range): boolean {
    const elRange = document.createRange();
    elRange.selectNodeContents(el);

    return !(
      range.compareBoundaryPoints(Range.END_TO_START, elRange) > 0 ||
      range.compareBoundaryPoints(Range.START_TO_END, elRange) < 0
    );
  }
}
