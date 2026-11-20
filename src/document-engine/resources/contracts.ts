/** Resolve bytes without exposing storage, network clients or URL ownership. */
export interface DocumentAssetResolver {
  data(url: string, base?: string): Promise<string>;
}

/** Layout consumers need presentation identity, not CSS serialization details. */
export interface DocumentPresentation {
  layoutFingerprint(): Promise<string>;
}

/** One capture owns preparation and its final presentation-consistency check. */
export interface DocumentResourceContext extends DocumentAssetResolver, DocumentPresentation {
  prepare(root: HTMLElement): Promise<void>;
  styles(): Promise<string>;
  assertCurrent(): void;
}
