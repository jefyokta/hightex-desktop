# Experimental editor page view

Enable **Settings → Editor → Page view (experimental)**, either in the workspace
settings or the editor settings dialog. The preference is local application
configuration (`editor.pagination`) and defaults to false. It applies to the
active editable chapter. Frozen/generated chapters retain their existing views.

This is an experimental editor layout. **Paged.js print preview and PDF remain the
authority for final page breaks and document-wide page numbering.** The page
count displayed in the editor starts at 1 for each chapter.

## Layout rules

- A4, default 30 mm margins, and a 24 CSS pixel gap between sheets. Defaults
  match the current PDF size and margins; editor API overrides do not change
  the PDF compiler's configuration. The gap is display-only.
- Paragraphs, code and list contents flow across pages at measured line
  boundaries. Measurements include visible inline node contents, such as tall
  fractions, rather than relying on their wrapper height. Model nodes are never
  split, so ordered-list starts, references and IDs remain intact.
- Consecutive headings stay with the first following content unit when the
  group fits on one page.
- Tables can split rows and cell contents. Continuations repeat the original
  caption and leading header rows, including merged headers. Frozen row heights
  prevent later rowspan growth from moving content on earlier pages.
  Nested tables are measured after their preceding parent content is placed,
  so parent page gaps cannot invalidate a child's page alignment.
- Figures keep their captions. Indivisible visual content is scaled to fit
  using derived presentation; stored image dimensions remain intact.
- The paragraph planner tries to leave at least two lines on each side of a
  split when the available space permits it.
- A horizontal-rule node (`---`) starts a new editor page, including inside
  lists and table cells. Its visual separator is replaced by the paper gap.
- Invalid or nonconvergent layout stops the pass, removes the paper chrome,
  and reports an error. Content remains editable in continuous view. Toggling
  the setting retries the layout.

The editor does not calculate preceding chapters' page offsets. Its node views
also differ from compiler-resolved citations, references, equations and generated
content. Therefore matching the
paper dimensions does not establish parity with Paged.js.

## Configuration API

Dimensions are millimetres; each margin defaults to 30. Header and caption
repetition are independent and default to true:

```ts
EditorPagination.configure({
  margins: { top: 25, right: 25, bottom: 30, left: 35 },
  repeatTableHeader: true,
  repeatTableCaption: false,
});
```

Update an existing editor without changing its content or undo history:

```ts
editor.commands.configureEditorPagination({
  margins: { left: 40 },
  repeatTableHeader: false,
});
```

Runtime patches preserve unspecified sides and flags. Changes cancel stale
measurement and recalculate the layout. Margins must be finite and nonnegative,
leaving at least 20 mm of content width and height; invalid values throw before
changing the active configuration. Disabling repetition removes only derived
continuation furniture, leaving the original header/caption intact. Disabling
pagination restores the existing continuous editor styles. Configuration is
local to the editor instance and is not saved into chapter content or archives.

## Document and editor lifecycle

`src/editor/pagination/` separates the pure paragraph planner, cached line
measurement, table layout, atomic fitting, snapshot lifecycle, boundary input
handling and Tiptap extension. The extension is added only by the live
editor, not by `ChapterExtensions.contentSchema` or the print compiler.

Measurement uses an inert, hidden copy of the rendered editor DOM, with old
pagination decorations removed. It never creates another editor, warms a
document, switches global chapter state, or runs autosave. Loaded image sizes
and chapter numbering are preserved in the copy. Transform-based zoom does not
change the measured layout.

Page spacers and block margins are ProseMirror decorations. Sheet backgrounds
and chapter-local numbers are noninteractive DOM outside the editable root.
Neither is stored in chapter JSON, serialized HTML, the clipboard serializer,
or portable archives. Layout transactions do not change the document or enter
undo history.

Block gaps are calibrated in the snapshot against their actual DOM movement.
Adjacent sibling margins and margins inside node-view wrappers can collapse;
adding a CSS margin alone can therefore move a block less than the planner
requested. The calibrated margin is used unchanged by the live decoration so
the missing displacement does not accumulate over subsequent pages.

Layout is recalculated after a 120 ms debounce following document edits,
rendered node-view changes, resizes, font loading or image loading. Measurement
waits until composition has ended. Switching chapters, disabling the mode and
destroying the editor remove page chrome and release subscriptions/timers.
Measurement yields between time slices and is cancelled when edits invalidate
its captured document. Unchanged immutable model nodes reuse cached line
measurements; width and font changes invalidate that cache.

Uneditable inline page spacers can make native browser editing ambiguous at
their boundary. Plain text input and grapheme deletion there use ProseMirror
transactions, retaining input rules, undo and the normal commit notification.
IME composition remains under the editor's normal handling.

## Verification

```sh
bun test tests/editor-pagination.test.ts tests/locales.test.ts \
  tests/editor-persistence.test.ts tests/document-loading.test.ts \
  tests/editor-save.test.ts tests/editor-export-flush.test.ts
bunx tsc --noEmit
env -u ELECTRON_RUN_AS_NODE node_modules/.bin/electron tests/integration/editor-pagination.cjs
```

The Electron fixture uses an isolated temporary profile. It checks actual
paragraph rectangles against page content boundaries, zoom, selection across
breaks, toggling, saved content, JSON/HTML serialization, autosave, undo, loaded
image/caption layout, split tables, merged cells, nested tables/lists, code,
hard breaks, tall inline math, visible glyph bounds, native boundary input,
light/dark appearance and the production editor's settings and
chapter lifecycle. It writes screenshots to the temporary artifact directory.

These checks have been exercised on macOS. They do not establish Windows/Linux
behavior or identical editor/PDF pagination. The separate comparison below
checks selected product-quality properties against the production compiler.

The margin-collapse regression is included in the native fixture. A broader
clipping sweep also exercises mixed block transitions and checks the same
requested displacement with different collapsed descendant margins:

```sh
env -u ELECTRON_RUN_AS_NODE HIGHTEX_PAGINATION_CLIPPING=1 \
  node_modules/.bin/electron tests/integration/editor-pagination.cjs
```

Run the isolated performance comparison separately from other checks:

```sh
env -u ELECTRON_RUN_AS_NODE HIGHTEX_PAGINATION_PERF=1 \
  node_modules/.bin/electron tests/integration/editor-pagination.cjs
```

It compares synchronous transaction timings with pagination off/on, measures
cold/warm layout, verifies cached/fresh plan equivalence after a paragraph edit,
and checks cancellation cleanup. It does not measure end-to-end human typing
latency or prove performance on every document.

## Seeded stress test

```sh
env -u ELECTRON_RUN_AS_NODE node_modules/.bin/electron \
  tests/integration/editor-pagination-stress.cjs
```

The suite generates deterministic mixed chapters for seeds `7,41,2026,24301`.
It checks glyph and atomic-node boundaries, repeated table captions/headers,
cached/fresh layout equivalence, layout stability, toggle cycles, exact JSON
through edits/undo/redo, chapter-body persistence, and cancellation/destruction
during active measurement. Normal-chapter H1 normalization remains part of
the existing persistence contract. A separate case exercises 1,200 paragraphs
and a 60-edit burst. The API matrix covers asymmetric margins and all four
header/caption repetition combinations.

Failures produce a nonzero exit code plus a temporary `stress-report.json`,
reproduction JSON, operation sequence, and screenshot. Geometry findings are
recorded while the remaining integrity checks continue. Renderer crashes and
the overall deadline also fail the process. Timing and heartbeat observations
include fixture construction and full-document geometry audits; they are
diagnostics, not measurements of human typing latency or an acceptance
threshold. This suite does not
compare editor output with Paged.js.

Replay selected seeds or one case:

```sh
env -u ELECTRON_RUN_AS_NODE HIGHTEX_PAGINATION_SEEDS=7,41 \
  node_modules/.bin/electron tests/integration/editor-pagination-stress.cjs
env -u ELECTRON_RUN_AS_NODE HIGHTEX_PAGINATION_CASE=seed-7-mixed \
  node_modules/.bin/electron tests/integration/editor-pagination-stress.cjs
```

## Comparison with production Paged.js

```sh
env -u ELECTRON_RUN_AS_NODE node_modules/.bin/electron \
  tests/integration/editor-pagination-compare.cjs
```

Requires `pdftotext` and `pdftoppm` (Poppler) on PATH for native PDF coverage
verification and raster previews.
Both surfaces read the same normalized chapter JSON in an isolated temporary
profile. The print surface uses the real compiler pipeline, print styles and
`BaseHandler`, rather than a simplified Paged.js renderer. Generated bibliography
pages are counted separately from the editable chapter. Different page breaks
and page counts are allowed.
The normalized editor JSON and the chapter content read by the compiler must
have identical SHA-256 hashes. Both hashes are recorded for every case; a
mismatch fails the comparison before output is accepted.

Six cases cover paragraph/heading transitions, nested ordered lists with custom
starts, merged table headers with a multi-page cell, images/tall math/citations/
variables/references, code with explicit breaks, and a nested table after a long
prelude. The audits check:

- Unique source markers remain complete and appear once, except intentional
  repeated headers/captions. Ordering is checked within paragraphs and serial
  flows, allowing independent table cells to interleave across pages.
- Visible characters and atomic nodes stay within content bounds on all pages.
  Suspect Range rectangles are checked character by character to exclude
  collapsed trailing whitespace. Repeated editor table furniture is included.
  Hidden KaTeX accessibility text is excluded.
- Paragraphs/headings containing only text and hard breaks are reassembled by
  stable fixture IDs, then compared against their full source text. This catches
  missing ordinary characters even when all coverage markers survive. It is
  separate from PDF marker coverage and does not assert exact PDF glyph text.
- Images must load, remain visible and share a page with their complete caption.
- List starts, original table headers/captions and table numbering survive
  continuation, including header repetition in standalone/nested tables. A
  standalone Grid is not required to acquire a Table caption.
- Consecutive headings stay on the same page as the next heading/content marker.
  Multi-line heading chains and three-line paragraphs have regression coverage:
  heading lookahead includes every heading line and follows the paragraph
  planner's rule that short paragraphs move whole.
- Explicit breaks advance to a later page. Resolved citation, variable and
  reference labels agree and are all present.
- Native PDF text extraction retains the source markers. This catches content
  still present in the Paged.js DOM but absent from the printed page.

Deliberately removing/duplicating a marker, removing an ordinary source character,
moving text beyond its page, shifting repeated table furniture outside the paper,
and giving the break checker two markers on the same page verify that the audit
rejects damaged output. Input preservation and renderer/compiler errors are
also checked. The editor must pass every checked property; a shared failure is
not accepted simply because the baseline has the same problem.

The temporary `comparison/report.html` compares full-sheet editor screenshots
with rasterized native compiler PDF pages, alongside per-case JSON, compiler
PDFs and extracted PDF text. The visual baseline is the actual printed PDF;
Paged.js DOM geometry is recorded separately in the audit. Capture expands the
viewport height until the whole sheet fits and verifies the sheet's aspect ratio.
`report.json` records baseline
failures, editor regressions and improvements separately. A missing PDF marker
or failed explicit break selects the corresponding source marker on both
surfaces, where possible; otherwise previews show the first clipping page, or
page 2 when there is no problem. Run a single case with
`HIGHTEX_PAGINATION_CASE=numbered-nested-lists`.

On macOS, the six same-input editor comparisons passed, while four compiler/
Paged.js cases required review. Chapter page counts exclude the compiler's
additional generated bibliography page:

| Case | Editor pages | Compiler pages | Compiler/Paged.js findings |
| --- | ---: | ---: | --- |
| Paragraphs and headings | 6 | 6 | No checked failures |
| Nested numbered lists | 5 | 5 | No checked failures |
| Merged headers and long cell | 12 | 14 | 64 markers absent from PDF; 6 text-boundary findings |
| Images, math, citations and references | 6 | 6 | 1 inline-math boundary finding |
| Code and explicit breaks | 4 | 4 | 1 explicit break stays on the same page |
| Nested table after long prelude | 7 | 6 | 42 markers absent from PDF; 13 text-boundary findings |

The table markers remained present in compiler source HTML and the Paged.js DOM;
their absence from native PDF text coincided with text positioned outside the
paper's horizontal bounds. This distinguishes output loss from missing input.
Selected full-sheet screenshots and PDF rasters were also inspected: paragraph
typography and list labels were readable, and the editor's continuation captions
and merged headers remained visible. The continuation suffix and some break
positions differ between the two surfaces. This visual sample is not an audit of
every page. The process exit status gates editor quality and evidence integrity;
it does not mean the compiler baseline passed.

These findings apply to these synthetic fixtures and this compiler/Paged.js
pipeline. Painted glyph bounds are approximated by browser rectangles; broader
document/platform coverage is still needed before release acceptance.

Run the expanded comparison separately:

```sh
env -u ELECTRON_RUN_AS_NODE HIGHTEX_PAGINATION_COMPARE_EXTENDED=1 \
  node_modules/.bin/electron tests/integration/editor-pagination-compare.cjs
```

This adds empty paragraphs and consecutive headings, headerless standalone
tables with empty cells, standalone tables with headers, body rowspans containing
multiple paragraphs, forced breaks
inside table cells, list/table/code nesting, oversized images with long captions,
Unicode with mixed marks and hard breaks, consecutive/edge breaks, multiple
nested tables inside one cell, and mixed chapters from seeds `13,97,509,65537`.
All inputs must pass schema validation before loading. Reproduction JSON and
screenshots are retained on comparison errors as well as quality findings.

The figure-table node view normalizes its first row into header cells. The
headerless fixture therefore uses a standalone table and asserts that its
normalized input still contains only body cells before counting this coverage.

The expanded macOS run passed all 20 editor comparisons across 177 chapter pages,
1,308 full-text paragraph/heading blocks and 65 heading/content pairs. No checked
editor content, geometry,
figure-caption, table continuation, list numbering or resolved-label failures were
found. The compiler/Paged.js baseline had findings in 14 cases, including content
loss and duplication in the mixed/rowspan fixtures, separated consecutive
headings, and missing continuation headers in standalone/nested tables. These are
findings in the
complete HighTex compiler pipeline; they do not isolate responsibility to the
Paged.js library itself. Explicit consecutive breaks can produce different blank
page counts, which are reported rather than required to match.

The isolated performance fixture also records native Electron `insertText` to the
next animation frame with pagination off/on, restoring the same chapter JSON per
mode. It samples 30 burst inputs and 20 inputs spaced 170 ms apart per mode on
400 paragraphs and 60 table rows. Exact document JSON and paginated glyph bounds
must remain correct after insertion. `performance-report.json` retains every
sample and the cache/transaction diagnostics. This includes IPC and frame wait;
it is not physical keyboard-to-paint latency and has no release acceptance
threshold.

Run Electron fixtures sequentially: Vite still reserves its default WebSocket
port with HMR disabled, so concurrent fixture startups can emit development
transport errors. These are distinct from the editor/compiler audits.
