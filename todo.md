# Task: Dynamic Front Pages Based on Category Variant

## Context
`Category` currently uses a `min?: boolean` flag to distinguish thesis vs proposal documents. This is being replaced with a single `variant` field to also support a third document type (kerja praktek / intern report). The `Category` type itself has **not been updated yet** — do that first.

## Goal
Make the printable front/cover page render dynamically based on `document.category.variant` instead of the old `document.category.min` boolean. Add a placeholder front page for the new variant (kerja praktek) even if its final content isn't finalized yet.

## Scope

### 1. Update the `Category` type
- Add `variant: "thesis" | "proposal" | "intern"` (rename `"intern"` if a better term is decided later — leave a `// TODO: confirm variant name` comment above the type).
- Keep `min?: boolean`  in place for now (do not remove) — they may still be referenced elsewhere and will be migrated separately.

### 2. Locate and update `components/printable/index.tsx`
- Find current usage of `document.category.min` (this drives which front page renders).
- Replace the min-based branching with variant-based branching:
  - `variant === "thesis"` → existing full front page (current default/`min === false` path)
  - `variant === "proposal"` → existing partial front page (current `min === true` path)
  - `variant === "intern"` → **new placeholder front page component**

### 3. Add placeholder front page for `intern` variant
- Create a minimal front page component (can reuse layout structure from thesis/proposal front pages for now — same shell, placeholder text like "Laporan Kerja Praktek" title block).
- Wire it into the same switch/conditional in `components/printable/index.tsx`.
- Don't worry about final styling/content accuracy — this is a stub to unblock the variant switch, to be refined later.

## Acceptance Criteria
- [ ] `Category` type includes `variant` field
- [ ] `components/printable/index.tsx` no longer branches on `document.category.min` — branches on `document.category.variant`
- [ ] All three variants (`thesis`, `proposal`, `intern`) render without runtime errors
- [ ] Existing thesis/proposal front pages render identically to before the change (no regression)
- [ ] New placeholder front page renders for `intern` variant

## Out of Scope (do not touch)
- DB migration / backend schema changes for the `variant` column
- Removing `min`field
- Finalizing the intern front page's actual academic content/layout