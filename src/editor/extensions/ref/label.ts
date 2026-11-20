export type RefKind = "head" | "imageFigure" | "figureTable" | "equation";

// Thesis labels stay Indonesian independently of the application's UI language.
const REF_LABELS = {
  head: "Lampiran",
  imageFigure: "Gambar",
  figureTable: "Tabel",
  equation: "Persamaan",
} as const;

export const INVALID_REFERENCE_LABEL = "Referensi ?";

export const isReferenceKind = (kind: string): kind is RefKind =>
  Object.prototype.hasOwnProperty.call(REF_LABELS, kind);

export const formatReferenceLabel = (
  kind: RefKind,
  numbering: string | number,
) => `${REF_LABELS[kind]} ${numbering}`.trim();
