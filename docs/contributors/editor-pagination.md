# Editor pagination

The product uses one pagination path for the editor, toolbar PDF export,
workspace PDF export and Split compilation. All call the canonical capture and
native print pipeline. Pagination is always enabled, including saved settings
from the former opt-in version; the UI no longer switches to continuous mode.
Legacy PDF code and IPC remain for compatibility and the deferred cloud viewer.
This integration does not turn bounded fixture results into whole-corpus or
release acceptance.

## Composite abstract sections

Abstract editors include their existing
template metadata and keyword suffix around the editable body. `SectionComposition`
owns this shell; `PaginationView` and `EditorSectionRenderer` pass it through
the same `LayoutSnapshot` and planner. Template blocks have generated slot IDs;
they are not authored ProseMirror nodes. An existing source H1 occupies the
template's title slot, with a derived outline anchor when needed. Keyword editing
controls sit outside the measured sheet, and metadata updates preserve the editor
instance, selection and history.

Content whitespace, wrapping and ligature rules are persistent in `editor.css`.
Do not depend on Tiptap's injected stylesheet surviving navigation: its lifetime
follows editable views and can end while snapshot compilation remains active.
This includes the zero dimensions of `img.ProseMirror-separator`: ProseMirror may
insert this cursor helper into a read-only schema view, although it has no image
asset in the authored source. `LayoutSnapshot` excludes it from measurement, so
its rendered size must remain zero without an editable Tiptap instance. The
persistent pagination CSS owns its display, border, margin, width and height,
plus nested editing-boundary and preformatted whitespace. A workspace export
fixture must unmount its initial editable view before rendering the actual row
menu; keeping that view alive can conceal missing shared presentation rules.

Snapshot version 3 carries canonical contexts and ordered physical
views. The print host selects a bounded run from one canonical context per native
print. `PDFPageAssembly` crops the native strip into selectable physical pages and
rebuilds final internal destinations. Debug still selects individual pages.
Debug HTML uses the same frozen snapshot with page navigation. The retained
experimental transport namespace accepts canonical v3 only; the legacy PDF
implementation and IPC are separate.

Every editable section now uses the canonical context renderer, with optional
abstract composition. Capture does not reuse the active editor's plan or wrapper
DOM. Ordinary editor NodeViews still need complete presentation and editing
acceptance; the mixed application fixture is one bounded proof. See the
[document engine](document-engine.md) and [PDF flow](editor-pdf-experimental.md).
`PaginationView` now schedules `ChapterLayoutCompiler` with captured source and
resolved dependencies. It publishes the frozen result's effects through a metadata
transaction, keeping the same EditorState/history/selection owner. It does not
measure React NodeView DOM or observe UI/selection mutations for layout. One
`EditorLayoutSource` observer feeds local layout and document numbering. Turning
pagination off releases compilation/resources/subscriptions; stale jobs cannot
publish after source/options/resource changes.

Cross-request result caching is supplied by the application-owned bounded layout
cache. Editing/performance coverage and whole-feature acceptance remain separate
from that implementation; further performance/retention work is deferred to the
next version by the user.

## Original page-view behavior (historical)

The earlier implementation offered **Settings → Editor → Page view (experimental)**, either in the workspace
settings or the editor settings dialog. The preference is local application
configuration (`editor.pagination`) and defaulted to false. It applied to the
active editable chapter. Frozen/generated chapters retain their existing views.

The current product wiring supersedes that opt-in UI. Whole-feature verification
still follows the complete acceptance contract.

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

### Table column sizing

`editor/extensions/table/widths.ts` owns the 1 CSS pixel minimum and column
fitting rules. Explicit widths that fit are retained. Automatic columns share
the remaining container width; oversized columns fit proportionally without
changing source attributes, fonts or images. Pagination reports that recovery
as a table diagnostic. The enclosing cell is the width boundary for nested tables.

`ChapterTableView` applies concrete columns on creation and update, clearing stale
width/min-width styles. A shared presentation plugin refreshes parent tables
before nested tables after source or container changes. Each editor/read-only
view owns one ResizeObserver and disconnects it on destruction. During a resize,
the gesture owns the preview so observer refreshes cannot overwrite it.

Resizing retains ProseMirror's handle detection and decorations. The gesture
uses visible column widths and compensates for zoom, clamps to the container,
then commits the preview widths in one source transaction across colspan/rowspan
owners. Automatic/fitted columns become explicit only through that user edit.
Dragging an internal border transfers width between its two neighboring columns,
retaining the table's width and position. The outer right edge resizes the table;
centered tables compensate for the width change on both sides so the edge follows
the pointer. Widths retain their fractional values, including through HTML
serialization/parsing, rather than rounding unrelated columns during a gesture.
The temporary feedback shows column widths, the 1 px/container limit and Escape.
It lives outside editor content, uses `data-editor-ui`, and is removed with the
gesture along with its cursor/active-handle presentation.
Escape/blur cancels the gesture; source changes and destruction release listeners.
Snapshot rendering and ordinary fitting never write authored widths.

The table context menu also applies the clicked cell's visible width to every
logical column in that table through `applyCellWidthToTable`. Merged cells use
their average per-column width and retain their spans. The right-click target
selects the nearest cell/header, including nested tables; the command uses the
same presenter, fitting rule and one-transaction column setter as resizing.
The result stays within its own container and supports undo/redo and persistence.

The bounded regression runs with:

```sh
bun test tests/table-widths.test.ts
env -u ELECTRON_RUN_AS_NODE node_modules/.bin/electron tests/integration/editor-table-widths.cjs
env -u ELECTRON_RUN_AS_NODE HIGHTEX_TABLE_WIDTHS_UX=1 node_modules/.bin/electron tests/integration/editor-table-widths.cjs
env -u ELECTRON_RUN_AS_NODE node_modules/.bin/electron tests/integration/editor-table-width-apply.cjs
```

It covers initial/update/unset widths, 1 px columns, oversized and nested tables,
five small native PDF cases, preview/commit, undo/redo, Escape, zoom, margin changes
and table-node remount from stored content. It does not certify the full document
corpus or physical OS interaction matrix.
The UX mode checks pointer/border movement and stable table position, feedback
cleanup and fractional HTML round trips, then prints one edited automatic table.
It does not repeat the five static native PDF cases.

### Pagination options

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

Vertical arrows crossing an inline page gap resolve the adjacent text line through
the view's coordinates. This avoids Chromium jumping past the remaining paragraph
around a tall uneditable widget. Shift keeps the selection anchor; ordinary keys
away from gaps stay with the editor. The transaction changes selection only.

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

| Case                                   | Editor pages | Compiler pages | Compiler/Paged.js findings                            |
| -------------------------------------- | -----------: | -------------: | ----------------------------------------------------- |
| Paragraphs and headings                |            6 |              6 | No checked failures                                   |
| Nested numbered lists                  |            5 |              5 | No checked failures                                   |
| Merged headers and long cell           |           12 |             14 | 64 markers absent from PDF; 6 text-boundary findings  |
| Images, math, citations and references |            6 |              6 | 1 inline-math boundary finding                        |
| Code and explicit breaks               |            4 |              4 | 1 explicit break stays on the same page               |
| Nested table after long prelude        |            7 |              6 | 42 markers absent from PDF; 13 text-boundary findings |

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

## Document numbering in the editor

The live footer uses the document engine's final numbering metadata, including
preceding parts and appendix resets. A local chapter page index is insufficient
for this. `DocumentNumberingView` debounces work after the active layout is ready,
observes committed document sources, and cancels stale work on editing, navigation,
resource changes or disable. It uses isolated read-only views through the same
`DocumentRenderSession` lifecycle as export. It does not print, package a PDF, write
source, mount another editable chapter or change selection/history.

Numbering pending/error is separate from local pagination readiness. Initial
labels remain empty until available; a refresh can retain previous labels while
showing pending status. A failed document render exposes an error and retry rather
than displaying invented offsets. Export independently freezes and renders its
current source. `documentNumbering: false` selects local diagnostic labels for
standalone layout fixtures; product page numbering uses the full document.

`PaginationOptions.sections` configures `introduction`, `content` and `appendix`.
Both live geometry and full-document rendering use these groups. Options include
per-group margins, number position and decimal/Roman/alphabetic number format.
The selected `section` policy overrides its group; explicit export policy has
final precedence. There is no new settings UI or persistence format.

Run the actual editor navigation and native PDF regression with:

```sh
env -u ELECTRON_RUN_AS_NODE node_modules/.bin/electron \
  tests/integration/editor-document-numbering.cjs
```

It verifies global offsets, invalidation after earlier chapter changes, direct
glyph/page equivalence for editable introduction and appendix content, appendix
A/B numbering, long DOI/URL bibliography entries across pages, source/selection/
history preservation and cancellation cleanup. Whitespace at a justified fragment
boundary follows the source mode: `break-spaces` retains boundary spaces, while
hanging/collapsible whitespace is collapsed only in the render copy. Bibliography
wrapping lives in its shared CSS owner. This bounded native check does not certify
all platforms or editing combinations; whole-document idle-render cost still
needs representative performance measurements.


## Editor controls and development HTML inspection

`data-editor-ui` marks controls, not document content. Controls are non-editable
and positioned outside the content flow. Measurement, page fragments and repeated
furniture use the shared `editorNonContentSelector` to omit them. Hover/focus
indicators use outlines; changing border width on authored content is forbidden.
Mutations inside marked controls do not invalidate the page plan. Captions,
references and visible equations remain document content, even when interactive.

In development, the experimental export controls include **Debug HTML**. It uses
the same `captureDocumentPDF` and internal `EditorPDFPrint` route as native export.
The debug window opens DevTools and shows the final captured HTML. Its export
button submits the same snapshot; editing the document afterwards does not
recapture it. Debug controls are outside the page set and hidden when printing.
The action is absent from production UI and rejected by main in packaged apps.

`EditorPDFHost` owns each window, ready handshake, cancellation, timeout and
cleanup. The PDF service owns validation, PDF metadata and atomic saving.
`captureEditorChapterPDF` belongs to tests/helpers; product capture has one entry.
Run `tests/integration/editor-pagination-ui.cjs` for hover/selection/menu geometry,
source preservation, exact-snapshot debug export and close/cancel cleanup.

## Shared styles and serialized geometry

`editor.css` imports the shared content rules in `table.css`, `list.css` and
`editor-code.css`. Pagination effects belong to `editor-pagination.css`;
`editor-affordances.css` and `editor-table-controls.css` own editor interaction
styles. PDF capture freezes this same stylesheet graph. List indentation and
table content must not acquire a second print-only implementation.

Continuation furniture stores planned coordinates in CSS custom properties.
Assigning ordinary numeric `top`, `left` and `width` properties loses precision
when Chromium serializes CSSOM to HTML. A fresh DOM and cached HTML can then
have different geometry even when their serialized strings match. Keep the
coordinate tokens intact at the shared presenter; do not hide this with a
comparison tolerance or an independent export layout.

## Split compatibility

`captureDocumentPDF` accepts an editor, a read-only document context or a stored
document ID. The ID path waits for committed storage, resolves the existing
category and builds a snapshot context without warming or activating an editor.
`generateDocumentPDF` owns cancellation of its experimental native byte request.
The main service validates, prints and assembles through the existing PDF path;
the legacy PDF service and IPC remain available.

Split reads canonical section IDs and page ranges from PDF subject metadata.
Chapters I–III and the last numbered chapter are public; intervening chapters
are private. Other sections, including bibliography, appendices and CV, are
public. Signed statement/consent uploads replace those named sections. The
original validity section is retained, and the plagiarism upload is inserted
with the signed uploads after the cover. Legacy `ExportPayload` PDFs retain
their detail-based split path, with numerical chapter sorting.

`SplitPages` detaches internal destinations while copying, then maps links to
pages actually present in each output. Excluded or unresolved destinations use
`#`; they must not recursively copy an excluded page. The original PDF keeps
its original destinations. Malformed or incomplete split ranges are rejected
because their page ownership cannot be trusted, without changing export's
content-recovery policy.

## Editor sidebar

The sidebar contains citations, document settings and variables. Chapters and
headings use the existing toolbar picker. The former chapter tree and iframe
preview components, their context-menu preview action and editor frame listeners
are removed. Guide selectors and descriptions follow the current controls.
Legacy printable routes, PDF service, metadata types and IPC are retained for
their remaining consumers. Release acceptance remains separate from the product
integration and the bounded evidence recorded for it.

## Shared export lifecycle

`EditorProvider` supplies one `DocumentPDFProvider` to the toolbar and page PDF
controls. Both use the same request, progress, cancellation and error state. Frozen
sections use their warmed read-only document context. Workspace rows use the same
`useDocumentPDF` hook with a stored document ID and the same status component.
The document action menu is nonmodal so starting export does not capture a
temporary modal scroll-lock stylesheet that disappears while sections render.
Real stylesheet changes still invalidate capture.

Current and historical chapter records are selected at `readExportDocument`;
archives continue to retain all revisions. Exporting a historical editor does
not substitute current chapter content.

Watermark export embeds the existing JPEG asset as a validated, fingerprinted
snapshot resource. The print viewport paints it beneath each physical page and
keeps paper wrappers transparent. Authored image pixels and content coordinates
are preserved; the watermark does not participate in page planning. PDF subject
metadata records `hasWm` for Split and inspection.

## Clipboard continuity and source identity

`ChapterClipboard` owns one native cut origin per editor. ProseMirror can collapse
a selection spanning a list and caption into the remaining caption when cutting.
Re-fitting that open slice at the resulting caret can create new figure wrappers
and change the list structure. For an unchanged cut origin carrying the same
clipboard token, `CutClipboard` restores the recorded source through an ordinary
transaction. IDs, references and undo/redo remain with their existing owners.
Restoration requires the exact recorded document and selection, so intervening
edits or moved selections cannot overwrite content. Undo can return to that exact
state and paste again. External clipboard data, copy, a new cut and view destruction
release the bounded origin. Active composition keeps native clipboard handling.
Identity-normalization transactions have an explicit marker and update its derived
after-state.

Schema rendering never allocates IDs. Missing source IDs are assigned by the
editor identity owner or immutable snapshot preparation; renderHTML omits a
missing ID instead of creating an untraceable anchor. Clipboard cut serialization
uses `EditorView.serializeForClipboard` for the same native HTML/text formats;
the cut token is transient and is never persisted in the document.
