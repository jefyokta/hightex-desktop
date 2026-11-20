/** Identities describe resolved layout dependencies, not editor focus or navigation state. */
export interface SectionLayoutIdentity {
  readonly documentId: string;
  /** Stored chapter ID for the editable section, including document prefix. */
  readonly sectionId: string;
  readonly sourceHash: string;
  readonly optionsHash: string;
  readonly presentationHash: string;
  readonly resourcesHash: string;
}

export interface SectionSourceLocator {
  readonly chapterId: string;
  readonly sourceRevision: string;
  readonly from: number;
  readonly to: number;
  readonly nodeId?: string;
  readonly figureId?: string;
  readonly assetId?: string;
}

export interface SectionLayoutTarget {
  readonly id: string;
  readonly page: number;
  readonly x: number;
  readonly y: number;
  readonly source: SectionSourceLocator;
}

export interface SectionLayoutLink {
  readonly target: string;
  readonly page: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly source: SectionSourceLocator;
}

export type PaginationBreakReason = "overflow" | "forced-break" | "keep-with-next" |
  "widow" | "orphan" | "short-paragraph" | "table-start";

/** Measurement-time coordinates are relative to the section's first content edge. */
export interface PaginationBreakGeometry {
  readonly fromPage: number;
  readonly toPage: number;
  readonly beforeTop: number;
  readonly beforeBottom: number;
  readonly limit: number;
  readonly targetTop: number;
  readonly displacement: number;
}

export type SectionLayoutDecision = { readonly source: SectionSourceLocator } & (
  | PaginationBreakGeometry & {
      readonly kind: "break";
      readonly placement: "line" | "block";
      readonly reasons: readonly PaginationBreakReason[];
      readonly trigger: SectionSourceLocator;
      readonly container?: SectionSourceLocator;
    }
  | { readonly kind: "fit"; readonly scale: number; readonly availableHeight: number }
  | { readonly kind: "table-continuation"; readonly page: number; readonly x: number;
      readonly y: number; readonly width: number; readonly height: number }
);

/** Calibrated presentation effects; reasons remain in the separate decision trace. */
export interface SectionLayoutEffects {
  readonly anchors?: readonly { readonly from: number; readonly to: number; readonly id: string }[];
  readonly breaks: readonly { readonly from: number; readonly to?: number; readonly kind: "line" | "block";
  readonly height: number; readonly marginTop?: number }[];
  readonly rows?: readonly { readonly from: number; readonly to: number; readonly height: number }[];
  readonly scales?: readonly { readonly from: number; readonly to: number; readonly scale: number }[];
  readonly furniture?: readonly { readonly top: number; readonly left: number; readonly width: number; readonly html: string }[];
  readonly generated?: readonly { readonly slot: string; readonly height: number; readonly marginTop: number;
    /** Inline flow offset within this generated slot; absent for a block movement. */
  readonly offset?: number;
  readonly movement: PaginationBreakGeometry; readonly reasons: readonly PaginationBreakReason[] }[];
}

export interface SectionCompositionDefinition {
   readonly html: string;
    readonly bodySelector: string;
     readonly headingAnchor?: string }

export function sameSectionComposition(left: SectionCompositionDefinition | null | undefined,
  right: SectionCompositionDefinition | null | undefined) {
  if (!left || !right) return left === right;
  return left.html === right.html && left.bodySelector === right.bodySelector && left.headingAnchor === right.headingAnchor;
}

export interface SectionContentIssue {
  readonly kind: "image" | "reference" | "variable" | "citation" | "math" | "table";
  readonly key: string;
  readonly message?: string;
  readonly source?: SectionSourceLocator;
}

/** Derived portable content and its recorded viewports; never an authored storage format. */
export interface SectionLayoutResult {
  readonly identity: SectionLayoutIdentity;
  readonly sourceSize: number;
  readonly pages: number;
  readonly geometry: Readonly<{ width: number; height: number; stride: number;
    margins: Readonly<Record<"top" | "right" | "bottom" | "left", number>> }>;
  readonly html: string;
  readonly sources: readonly SectionSourceLocator[];
  readonly decisions: readonly SectionLayoutDecision[];
  readonly effects: SectionLayoutEffects;
  readonly composition?: SectionCompositionDefinition;
  readonly targets: readonly SectionLayoutTarget[];
  /** Known source targets placed by other sections during final document assembly. */
  readonly crossSectionTargets: readonly { readonly id: string; readonly chapterId: string }[];
  readonly links: readonly SectionLayoutLink[];
  readonly issues?: readonly SectionContentIssue[];
}

export function sectionLayoutKey(identity: SectionLayoutIdentity) {
  return JSON.stringify([identity.documentId, identity.sectionId, identity.sourceHash,
    identity.optionsHash, identity.presentationHash, identity.resourcesHash]);
}
