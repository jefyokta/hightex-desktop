# Document engine

Code follows the ownership boundary rather than the feature's experimental label:

| Directory | Responsibility |
| --- | --- |
| `src/document-engine/layout/` | Canonical compiler, revision session, immutable publication, result cache and source locators |
| `src/document-engine/composition/` | Generated shell around an editable body |
| `src/document-engine/indexes/` | Document indexes and resolved rich outline titles |
| `src/document-engine/projection/` | Canonical context viewports and source maps |
| `src/document-engine/resources/` | Shared content fonts and portable CSS/image resources |
| `src/document-engine/renderers/` | Editor/template adapters |
| `src/editor/pagination/measurement/` | ProseMirror measuring copies, atomic fitting and image placement |
| `src/editor/pagination/flow/` | Text flow, line measurement and page planning |
| `src/editor/pagination/tables/` | Table grid, continuation and row planning |
| `src/editor/pagination/presentation/` | Applying recorded decorations, furniture and page numbers |
| `src/document-export/` | Preparing an export, snapshot transport, print installation and development inspection |

The pagination root contains the editor plugin, state, scheduling, input and
diagnostics. Files are moved with their consumers; old paths have no forwarding
modules. IPC names and the legacy PDF path remain independent.

`DocumentEngine` assembles an immutable document through two explicit adapters:

- `editor` renders authored Tiptap sections with the existing editor planner,
  source mappings and one canonical context per section. Every chapter compiles
  from the committed snapshot through the same renderer; the active editor's
  wrappers and plan are not reused. Abstract composition is optional input.
- `template` renders category HTML using its own CSS and native CSS column
  fragmentation. It never creates a Tiptap view or converts templates into editor
  nodes. It retains text size and validates content bounds before returning pages.

`ChapterLayoutCompiler` owns editable-section measurement and publication. It takes
resolved model/source, geometry, composition, portable image resources and dependency
hashes. It builds the canonical content surface, waits for fonts/images, runs the
existing planner to convergence and publishes one frozen `SectionLayoutResult`
through `SectionLayoutSession`. Source positions, decisions, calibrated effects,
HTML and target/link ownership describe that revision. The editor consumes the
published effects; `EditorSectionRenderer` adapts the compiled context into document
page descriptors without measuring again. The compiler never loads IDB or activates
an editor. Adapters own data delivery and the compiled context's lifetime.

The compiler's `paginate` method owns the bounded convergence loop. The chapter
owner rejects stale/failed plans when applying them; the compiler does not repeat
that check before the same call. `SectionLayoutSession` owns job identity and
cancellation. Publication belongs to `publish-layout.ts`, while the shared layout
module contains DTOs and identity/composition comparisons. Published data is cloned
and deeply frozen once, with first-owner target handling and guards for usable
geometry/effects and source ownership. Decision/movement traces are frozen
diagnostics, not an additional runtime acceptance gate.

The session returns published data to its consumer and retains only the identity
needed by invalidation events. The editor plugin/cache own results; the session
has no parallel ready-result store or lookup API. Outline extraction consumes
`CompiledChapter` labels, rather than declaring unused label getters on the
read-only measuring view. Types used only inside their module remain private.

The editor extension wires commands, input and views. `pagination/state.ts` owns
enable/reset, source invalidation, compiled publication and document-numbering
transitions. Its decoration consumer checks source compatibility and source-node
ranges; it does not compare a result identity with itself. The scheduler aborts
obsolete work and releases its task/compiled lease after completion. No second
signature tracker decides whether an already-current job may publish.

The compiler retains at most one idle canonical surface after a compiled context's
lease is released. A matching revision update reuses that ReadOnlyChapter, clears
its previous decorations/furniture and resolves the new immutable source before
measurement. Schema, geometry/composition or presentation/resource changes discard
the idle surface. A context with an outstanding lease remains independent; another
compile cannot mutate a page still consumed by document assembly. Cancellation
destroys a partially updated surface. Disable/navigation/dispose release idle
ownership, and a late lease cannot restore a surface after that lifecycle ends.
The result cache still contains portable immutable data only.

LayoutSnapshot uses native deep cloning and then pairs original/copy nodes for
source positions. It drops UI/widgets, resets derived pagination styles and retains
intrinsic image ratios before measuring. Cloning does not change the planner or
remove convergence checks. `tests/integration/editor-layout-reuse.cjs` compares cold
and reused compiler results, glyph/image placement, lease independence and cleanup.
Canonical table NodeViews forward updates to their existing native TableView, so
changes to cell `colwidth` refresh the colgroup when the surface is reused. The
reuse fixture compares table/column geometry as well as text and images after a
column resize. Its HTML comparison normalizes declaration order only, preserving
all CSS values, priorities and markup; native TableView can reorder declarations.

`EditorLayoutSource` caches resolved application data between buffer changes. One
source observer supplies both local layout and document numbering; an IDB refresh
never replaces editor state. Local edits use the captured buffer with those resolved
resources. Source/options/composition/resource/font/theme changes cancel obsolete
jobs, and the editor only publishes a result for the still-current buffer/options.
Page UI mutations, hover, selection, pane size and zoom do not remeasure content.

The layout source observer recognizes persisted content that matches its current
editor buffer and ignores the accompanying document `updatedAt` change. Other
chapter content, external writes that differ from the buffer, metadata and assets
still invalidate it. This avoids treating an ordinary matching autosave as a new
resource revision. Only the observer's layout mode uses native JSON change
detection; canonical archive/source identity remains owned by the compiler's
hashes. Unchanged snapshot chapter records reuse extracted graphs through a
source-owner WeakMap; document-order equation numbering is still recomputed.

`DocumentImageObserver` owns a separate image-table subscription. Its input is
the image table, document IDs and the referenced image set, not an editor or the
whole database. Ordinary chapter writes reuse that subscription without rereading
or hashing image bytes. A changed reference set replaces the subscription; owned
and cross-document referenced images remain observable. Byte hashes detect
replacement even when the ID, MIME type and size are unchanged. Initial source
readiness waits for image observation; abort/disposal invalidates late deliveries.
This observer only invalidates consumers: canonical source capture still owns the
resolved document snapshot and its resource identity.

Renderer adapters may own `destroy()` cleanup. DocumentEngine releases completed
sections and renderer resources once on disposal, including cancellation/failure.

`chapterPages` adapts a completed layout into page descriptors; its input contract
contains the canonical paper, content root, page count and source locators. It
groups target/link nodes in one geometry pass instead of scanning them again for
each page. It does not measure line flow or choose page breaks. The renderer still
owns compiler/image cleanup; duplicate IDs retain the first source locator.

Resource consumers depend on the operations they use: `DocumentAssetResolver`
resolves portable bytes, `DocumentPresentation` supplies layout identity, and
`DocumentResourceContext` adds preparation and capture consistency. The concrete
`DocumentResources` owns asset resolution and one `StylesheetSnapshot`; stylesheet
revisions, in-flight CSS capture and serialization belong to that snapshot. These
contracts do not expose storage or require a live editor.

The engine owns section order, page labels, bounded index/reference convergence,
request cancellation and disposal. It has no storage, application singleton,
Electron, PDF IPC or file-writing dependency. Renderers are constructor inputs;
`adapters/editor-document.ts` wires the application implementations. The current
category adapter reuses the existing templates and generated-content formatters.
The legacy Paged.js engine is independent and is not called by this engine.

The end-to-end entry points and renderer call sites are documented in
[the PDF flow](editor-pdf-experimental.md). Capture source preparation,
document rendering and native printing have separate owners. The shared IPC
contract is outside the renderer tree.

Table planning has one entry point, `pagination/tables/paginate-table.ts`. It coordinates
grid/flow collection (`tables/table-source.ts`), measured continuation furniture
(`tables/table-furniture.ts`), break selection/replay (`tables/table-breaks.ts`) and frozen row
state (`TableRows` in `tables/table-rows.ts`). Nested tables return through the same
planner. These phases retain the existing rowspan, widow/orphan and convergence
rules; fragment projection does not introduce a second planning algorithm.

`SectionOptions` groups layout policy by logical **introduction**, **content**
and **appendix** sections. Authored IDs such as `foreword`, `toc` or `1` identify
document parts; they are not configuration keys. `DocumentEngineOptions.sections`
applies the group's options to every matching part, including generated indexes
and native templates. The normalized group is available to section hooks and on
printed `data-document-group` attributes.

```ts
const sections = {
  introduction: {
    margins: { top: 30, right: 30, bottom: 30, left: 30 },
    pageNumber: { position: "bottom-center", format: "roman-lower" },
  },
  content: {
    margins: { top: 30, right: 30, bottom: 30, left: 40 },
    pageNumber: { position: "bottom-right", format: "decimal" },
  },
} satisfies NonNullable<DocumentEngineOptions["sections"]>;

// Select the same effective policy for the currently mounted content editor.
editor.commands.configureEditorPagination({ section: sections.content });
await captureDocumentPDF(editor, signal, undefined, { sections });
// A document-only capture has no live editor to configure:
await captureDocumentPDF(document, signal, undefined, { sections });
```

For direct engine wiring, pass `{ sections }` to `createEditorDocumentEngine`'s
options argument. A part can also carry `definition.options` as its defaults;
group configuration overrides those defaults, merging individual margin sides
and page-number fields. The engine copies configuration before rendering, without
changing caller data. Selecting a different live `PaginationOptions.section`
replaces that selection, while omitting the key preserves it; pass
`{ section: undefined }` to clear it. This prevents settings from a previous
chapter leaking into the next one.

The base geometry remains separate from the active section geometry. Both
renderers and the footer resolve the same effective geometry for each part.
Capture carries the selected policy into the active logical group. The canonical
renderer measures the effective policy instead of reusing a live plan.
Margin changes participate in index convergence and layout identity. Source
fingerprints identify source data; plan fingerprints also identify section policy.

Supported number formats are `decimal`, `roman-upper`, `roman-lower`,
`alpha-upper` and `alpha-lower`. `formatPageNumber` is shared by the live surface
and document numbering, so TOC/reference targets use the same formatted labels
as the printed pages. Appendix labels retain their existing prefix (for example
`A - i` when its page format is `roman-lower`). Unnumbered cover/CV sheets still
paint no label. The defaults remain lowercase Roman/bottom-center for introduction
and decimal/bottom-right for content and appendix.

The six positions are `top-left`, `top-center`, `top-right`, `bottom-left`,
`bottom-center` and `bottom-right`. Center is the physical paper center even with
asymmetric margins. Explicit paper coordinates avoid reliance on inherited CSS
margin variables. The existing flat margin and grouped `pageNumbers` settings
remain adapter defaults. Configuration currently has no settings UI.

Index generation follows one flow: editor/template renderer → `SectionOutline`
→ `DocumentIndex`/`IndexRow` → `TemplateSectionRenderer`. Renderers
use `outlineTitle` to copy resolved title content once. Index titles retain italic;
bold, underline, strike, code and link styling are removed. Resolved math keeps
its renderer's layout, without the duplicate MathML accessibility text. Source IDs,
editor controls and pagination gaps are removed. The original canonical DOM and
authored source remain unchanged.
`SectionOutline.text` is metadata for outline consumers; required `titleHTML`
carries inline presentation, and `group` identifies the owning section policy.
Heading/container layout is owned by the
index, so source heading size, alignment and page gaps are not copied into rows.

`IndexRow` renders the outline data directly with its rich title and page label.
There is no temporary heading DOM, legacy row conversion or title overwrite.
`outlineTitle` owns index mark policy rather than a general attribute sanitizer.
The English abstract section explicitly contributes an italic title.
H1 index titles use uppercase in scoped template CSS, except appendix titles.
Appendix titles, H2/H3 and captions retain source case and italic. The
appendix heading's `::before` still displays its uppercase `LAMPIRAN …` label.
Case presentation does not rewrite source or numbering data.

TOC, table and figure indexes fill dot leaders through `fillIndexLeaders` after
fonts settle and before measuring template columns. The legacy `TocBuilder`
keeps its own existing behavior. Experimental index rules live in
`src/css/document-index.css`; leaders use measured period glyphs in the document
font and align to the right of the available line. H1 titles, heading numbers and
page labels are bold; lower levels and caption entries remain regular. Inline
italic is preserved. Leaders do not use gradient backgrounds or bitmap patterns.
Every entry level, including H1 and unnumbered entries, receives a leader. A
minimum leader is reserved before measuring the remaining line width so long
titles wrap together with their bottom-aligned page number. Index convergence
therefore includes any page-count change caused by the final leaders.

The PDF capture adapter reads committed records through
`editor/storage/document-snapshot.ts`, after pending chapter saves complete.
The `.hightex` exporter uses that same reader. PDF input is adapted directly to
`DocumentRenderModel`; it does not create, compress or parse an archive. Imported
models can also satisfy this narrow rendering contract. Source fingerprints
identify content, metadata, author and image bytes; they do not prove visual parity.

Identity maintenance is separate from capture. The editor opening path waits for
pending saves and calls `Document.warm({ forEditing: true })` before mounting its
editable chapter. `DocumentIdentities` repairs saved chapters atomically and keeps
document-local reservations; the live normalizer shares `NodeIdentityAllocator`.
Unique IDs remain stable and duplicate IDs retain their first target in category
order. References are remapped only to that existing first owner, including a
renamed legacy ID. Bookkeeping transactions do not add undo steps. Other warm-up
paths load reservations without repairing storage; PDF snapshots do neither.

Clipboard insertion reserves existing node IDs before the pasted slice enters
the document. It shares `NodeIdentityAllocator` with stored/live maintenance:
copies receive available IDs without stealing an existing reference target;
cut targets can keep their IDs when no destination owner remains. Reference
HTML round-trips through its schema node. Automatic reference numbers are recounted
from source order and target kind/ID. Serialized `label` attributes remain in source
for compatibility but cannot override generated reference text. Missing targets
display `Gambar ?`, `Tabel ?`, etc. in red. Generated labels stay Indonesian.

Capture can stop waiting for pending autosaves, snapshot delivery and input
conversion when its signal is aborted. This releases the export request without
cancelling the user's queued database writes. A read that completes after export
cancellation is ignored. Once source/presentation are frozen, later edits do not
change that export. Changing the active editor unmounts its export control and
cancels the old request; late completion cannot update a newer control/request.

An active-editor export requested during IME composition waits for its final
commit or cancellation before binding the source revision. Pagination is pending
through composition and resumes after it ends. Readiness then requires a settled
plan; subsequent source changes reject preparation. The capture guard also rejects
a new composition before the read-only presentation is frozen. Cancelling export
or destroying the editor releases readiness listeners without ending the user's
composition or cancelling autosave. Native IME coverage uses Chromium composition
commands; it does not certify an operating system's candidate-selection UI.

Canonical content keeps the complete paragraph shaping context, including hard
breaks and list items, while physical page viewports select the recorded region.
No paragraph-wide last-line justification correction is applied for PDF. The
historical `FragmentSurface` remains confined to diagnostic fixtures.

## Events and hooks

Subscriptions are instance-owned and typed through `engine.events.on/off/once`.
`on` and `once` return an unsubscribe function. Only the engine can publish events.
A section is any document part; a chapter is an editor-rendered part, including
editable front matter and appendices. Templates do not emit chapter events.

| Event             | Contract                                                                        |
| ----------------- | ------------------------------------------------------------------------------- |
| `start`           | Accepted run begins; total section count.              |
| `section.before`  | Before the selected renderer; section, phase and pass.                          |
| `section.after`   | Pagination/resources for that section are complete; page count.                 |
| `chapter`         | One editable section completed, once; chapter ID, title and page count.         |
| `contentRendered` | All non-index parts completed; content page count and copied outline.           |
| `index.pass`      | One bounded index pass finished; pass number, changed IDs and stable flag.      |
| `diagnostic`      | Classified issue with severity, code, target, cause and section context.        |
| `rendered`        | Successful document assembled, numbered and checked; immutable result metadata. |
| `error`           | Compilation stopped because a fatal issue prevents reliable output.              |
| `cancel`          | Active run aborted, independently of compilation failure.                       |
| `dispose`         | Engine-owned pages/listeners released; emitted once.                            |

Every run event carries `runId`, `documentId`, increasing `sequence` and stage.
Phase hooks additionally receive the run `AbortSignal`. Section events identify
`phase: "content" | "index"` and pass; content pass is zero. `dispose` on an unused
engine has no document/run ID. Payloads do not expose the active editor, database,
or output DOM. Input definitions and outline data are copied for hooks; final
section/label metadata is frozen. The engine resolves `render()` with the same
completed result metadata and retains its pages until destroyed by the caller.

```ts
engine.events.on("chapter", ({ chapterId, pages }) =>
  updateChapter(chapterId, pages),
);
engine.events.on("contentRendered", async ({ outline, signal }) =>
  inspectOutline(outline, signal),
);
engine.events.on("index.pass", ({ pass, changed, stable }) =>
  logIndex(pass, changed, stable),
);
engine.events.once("rendered", ({ pages, warnings }) =>
  updateProgress(pages, warnings),
);
try {
  const result = await engine.render(output, sections, documentId, signal);
  // Capture the owned output here; rendered does not mean the PDF file was saved.
} finally {
  engine.destroy();
}
```

Content renders first, skipping TOC, table and figure indexes. `contentRendered`
emits once. Index passes then use existing numbering and index builders; they
replace changed indexes only and never render chapters again. Before an index
has measured pages, numbering reserves one provisional page in its original
slot. Later passes use its actual size until labels and HTML converge (at most
four passes). Final assembly preserves original section order. A document without
indexes emits no `index.pass` event.

`render-section.ts` owns routing, section hooks and late renderer cleanup.
`run.ts` owns cancellation, sequencing, phase hooks and terminal notifications.
`index.ts` orchestrates content, index convergence, references and assembly through
small phase methods. The adapter injects a page decorator for number furniture;
it runs during assembly before `rendered`, never through an outcome listener.
Decorators must not reflow content or choose page breaks.

Phase listeners run in registration order and async work is awaited with abort
support. A throwing/rejecting phase listener fails that run. Exactly one terminal
event is emitted: `rendered`, `error`, or `cancel`. Terminal/dispose listeners start
in registration order but their promises are not awaited. Sync/async failures are
logged with event/run context, cannot replace the established outcome and do not
skip later observers. A stalled outcome observer cannot hold capture or cleanup.
Consumers needing awaited work must use a phase hook or await `render()`.

Disposal is idempotent. Destroying an active run aborts it and emits `cancel`
before `dispose`; destroying inside an outcome observer defers cleanup until the
outcome dispatch finishes. Cancellation releases existing pages even if a hook or
renderer stalls. A renderer returning after cancellation has its late result
immediately destroyed. Renderers/hooks must honor their signal to stop their own
pending work. Engine instances are single-use.

`captureDocumentPDF(source, signal, engine => { ... })` exposes subscriptions before
the engine starts. UI progress and native fixtures use the same event contract.
There are no aliases for the former colon events, `references`, or `ready`.
The legacy Paged.js pipeline and IPC are independent of this experimental engine.

Contracts live in `src/types/document-engine.ts`; the exception lives in
`src/exception/document-engine-error.ts`. Recoverable input problems publish
`warning` diagnostics with a code, target/cause and section context; they do not
stop export. There is no strict export option. Any future blocking content policy
belongs to pre-compile/scanner, outside this layout/export engine.

Malformed or unsupported URLs and deleted internal destinations use `href="#"`.
Deleted authored references use the Indonesian kind + `?` in the shared resolver,
before measuring, with the existing red style. Numbers are still derived from
source structure. If a valid source target loses only its rendered destination,
the engine disables navigation and reports `reference.rendering`; it preserves
already-measured, source-resolved text rather than reflowing content after layout.
The print host also normalizes unusable hrefs; native PDF assembly omits unresolved
internal annotations while retaining page content and valid external links.

Missing or corrupt image bytes use the same portable placeholder in the editor
and canonical renderer, at the authored width and within normal page fitting.
Upload/repair controls are editor UI outside measured flow. Citation, variable
and math resolution retain their established presentation fallbacks. Resolved
content issues are frozen with the section result so cache hits retain diagnostics.
The category adapter keeps visible bibliography placeholders for missing or
malformed records. If combined formatting fails, it recovers entries individually:
valid records remain printed rather than replacing the entire bibliography. If all
records work individually, the combined-formatter failure is reported separately.
`content.unresolved` warnings preserve input kind/key in `ChapterContentError`.

Invalid authored image widths (zero, negative, nonnumeric or nonfinite) use the
shared schema default of 200 px in the live view, schema renderer, fitting and
layout decorations. Stored width stays unchanged for a future scanner.
The identity extension supplies the existing UUID attributes to nontext content
nodes; editor initialization, update and paste reuse the existing allocator.
Duplicate IDs reaching export do not stop it: source owner, numbering labels,
reference labels, source-map, snapshot destinations and native annotations retain
the first occurrence in document order. Later content remains printed. Strict
rejection belongs to future pre-compile/scanner, not the export engine. Logical
section metadata and output geometry still have their own structural contract.

Structural failures, stale/cancelled revisions, missing fonts/styles, unsafe host
markup and unreliable content geometry retain their existing guards. These have
no approved fallback that preserves the document contract. Do not add a new fatal
condition without discussing the concrete failure and recovery alternatives with
the user. Errors preserve their original cause across layers; warning hooks follow
the same cancellation and hook-failure rules as other awaited phase hooks.

Unexpected failures reach `ShouldReport` at application adapters: live pagination,
document numbering and normal export use the existing `ErrorSlave`; the separate
debug host renders the report action alongside the original error. The shared
`paginationReport` conversion keeps causes and document diagnostic fields and
preserves already-classified notifications. `EditorPDFStateError` identifies
retryable capture preconditions without localized-message matching. Cancellation
and recovered warnings remain outside bug reporting. Experimental main-process
handlers wrap unexpected service failures in their existing `ShouldReport` for
local logging, release request ownership, and preserve the original reason for the
renderer. Reports are submitted only through the user's existing report action.

Generated document reference labels are Indonesian independently of the UI
locale. Missing references carry `data-status="missing"` and use the same fixed
red content style in the live editor and captured pages, with exact print color.
PDF markup declares Indonesian as its document language; authored text and
manually typed text is preserved. Automatic reference labels are always derived.

The engine does not make preview UI. Product flow remains editor → direct export
→ native save dialog, through the separate experimental PDF service and IPC.
Development additionally offers HTML inspection of the captured snapshot through
the same print host. Its debug controls can export that exact snapshot without
running the engine again. They are outside the document page set and unavailable
in packaged applications. See [the PDF flow](editor-pdf-experimental.md) for the host
and capture call graph.

## Reusing published sections

`SectionLayoutCache` is a bounded LRU supplied through the application adapter.
It stores a frozen `SectionLayoutResult` and serialized compatibility plan, with
fresh plans/DOM for each consumer. It has no storage/workspace singleton dependency.
The application owner switches caches with its HighTexDB instance. Large results
can bypass caching without changing their output or acceptance behavior.

A cache hit still waits for resource readiness and enters the section revision
session, but does not construct a read-only editor or run the planner. Known
published results retain object identity across sessions; arbitrary frozen objects
do not bypass the publication boundary. Cold compilation and reuse use the same
source/options/dependency keys, independent of the active chapter.


### Content presentation and source diagnostics (implementation, 2026-11-18)

`chapterContentDOM` is the schema DOM factory used by canonical readonly views
and native editable node views for figures, list items, code blocks and images.
`chapterContentNodeView` owns ProseMirror bindings and mounts React controls in an
absolute `data-editor-ui` overlay. It disposes those controls with the node view;
schema attribute updates preserve content children and pagination decorations.
Tables retain their shared TableView owner. Canonical code views reuse the code
extension's decoration plugins, without its editing/paste handlers.

Math uses one KaTeX policy and shared block/inline components. Variable formatting
uses the existing applyCase/ParsedItalic owner through VariablePresentation; citation
status/text styling also has one presentation owner. Notes use the same deterministic
color presentation. Popup contents and toolbar controls remain editor adapters.
Normal export readiness waits for image decoding and settled variable/reference
loading in addition to citation/font/layout readiness. These are local resource
states, not another layout authority or a source write.

The figure-table NodeView no longer rewrites first-row cell types when mounted.
Its first-row header presentation, rowspan endpoints and repeated-header extent
are derived by shared rules. Only the primary table in a table figure receives
that policy; nested layout grids retain their own presentation.

Content issues carry optional SectionSourceLocator provenance, frozen together
with cached layout results. DOM provenance is obtained from the canonical view's
model bindings rather than guessing from labels or duplicate IDs. Existing layout
failures retain the visited source range through PaginationLayoutError; image
placement retains its existing bounds and provenance. Each diagnostic event uses
its own context without leaking that node into the next lifecycle event.

The editor status and export UI expose diagnostic details and Open source actions.
They reuse scanner navigation for chapter switching and selection. Pagination
navigation verifies the source hash against the mounted editor document before
applying the recorded location; stale results show a refresh message. Matching
revisions resolve the recorded tree path, including when IDs repeat. Composition,
font, host or transport failures without a meaningful source node remain document
or section diagnostics; the UI does not invent a node for them.

This describes implemented ownership and wiring. Visual/native-PDF equivalence,
all editable interactions and the extreme-case matrix have not been re-proven for
this presentation refactor. The user deferred those proofs until implementation
preparation is complete. Earlier evidence remains historical to its tested revision.

### Long captions and oversized table repeats

Image figures are image-plus-caption flow. Image fitting reserves the opening
caption lines using the shared text measurement, and the caption can continue
through ordinary paragraph breaks. Fitting changes derived dimensions only.
Table captions enter text flow before the grid at every nesting depth. The table
owner prepares this opening flow; the chapter traversal supplies preceding units
so heading/caption keep rules stay together. `applyFlowLayout` applies the same
paragraph planner for ordinary chapter flow and table openings. Nested continuation
breaks reserve the enclosing table headers without changing the page's bottom
limit. Once caption lines have fragmented, the table pass moves the remaining grid
without moving earlier caption fragments again.

Continuation furniture is measured independently from the complete source header
and caption. If full repetition would leave less than the existing 48 px minimum
body space (including enclosing table reservations), the approved recovery keeps
the first visual line of the caption and every header cell in the continuation
clone. Marks and cell/row structure remain; subsequent text is removed from that
derived clone, not clipped or deleted from authored content. Normal repeats stay
complete. Page gaps and duplicate destination IDs are removed from repeats while
fitted atom sizes are retained.

An actual compact continuation produces `pagination.table.repeat.compact`, with
the table's source locator. Its message and locator survive immutable publication
and caching and use the existing warning/navigation UI. The full source content
is still printed once. Existing structural guards remain if even compact repeats
cannot leave room for body content; this policy does not authorize further text
scaling, content loss or silently disabled repetition.

The bounded `HIGHTEX_CAPTION_FLOW=1` Chromium fixture checks normal continuation,
long original table captions, oversized headers, a tall image with long caption,
and a nested long caption inside a rowspan with adjacent cells.
It verifies source/text preservation, convergence, portable effects and measured
text staying within pages. The complete merged/nested matrix, editing workflow
and native PDF equivalence remain outside this focused check.

### Table combinations and editing lifecycle follow-up

The caption fixture also accepts `HIGHTEX_CAPTION_CASES=merged,adjacent-nested,nested-header`
and `HIGHTEX_TABLE_OPTION_MATRIX=1`. These deterministic cases cover merged headers
with long rowspans, adjacent child grids and a long nested header with a forced
break, under all four header/caption repeat settings. Checks cover convergence,
unchanged source/text, vertical text bounds and repeat-option behavior. They do
not certify visual border/column equivalence in native PDF or the full content matrix.

`HIGHTEX_EDITING_WORKFLOW=1` reuses the existing clipboard and IME fixtures with
native printing disabled, then checks content DOM identity, selection, attribute
undo/redo, pagination toggles, storage reload and cleanup. IME uses trusted Chromium
composition/input events, while clipboard uses editor ClipboardEvent/DataTransfer
handlers; physical OS candidate UI and the system clipboard remain separate checks.
`HIGHTEX_WORKFLOW_LIFECYCLE_ONLY=1` isolates remount/reload/cleanup checks when needed.

Reopening revealed that ContentFixer's list-item repair discarded authored attrs.
It now retains the original node fields while repairing children, preserving IDs
and nested list attributes. Math node views pass only their presentation attrs to
DOM and cancel their scheduled focus callback on cleanup. Pagination metadata still
does not enter source/history/storage; no new persistence or selection owner is added.

NodeView control callbacks keep the node view's identity across decoration and
attribute updates. Publishing pagination must not restart an unchanged image's
resource effect: doing so temporarily restores the placeholder with a different
aspect ratio while the canonical result still describes the resolved image. The
editing workflow checks the live image element, source and ready status through
control changes, undo and pagination toggles.

Native archive checks sample the resolved section contexts through
`tests/helpers/document-page-samples.ts`. Physical pages reuse those contexts;
searching page wrappers for paragraph clones would produce an empty audit. Samples
use actual text ranges and the recorded stride to identify their physical page,
and the archive fixture rejects an empty source sample set. This is sampled native
text/page evidence, not a complete glyph audit or a performance acceptance result.

### Generated composition text flow

Abstract headings, metadata and keywords use `measureTextLines`, the same browser
line-ink grouping used by authored text through FlowCache. Ordinary nested template
containers expose their text blocks as stable generated slots; their source HTML
and template styles remain owned by the composition. Mixed content stays intact.
The planner's widow/orphan, heading and forced-break rules operate on those measured
lines without creating authored ProseMirror nodes for metadata.

Generated effects carry a slot and optional inline-flow offset (text/inline-atom
positions, excluding derived page gaps). A block effect retains its calibrated
margin; inline effects insert the shared page-gap widget. Multiple distinct offsets
in one slot are frozen together with their movement/reasons. Applying a new result
clears previous generated gaps before replay, preserving text and marks. The
snapshot drops these widgets before measuring the next pass.

The editor retains the composition definition paired with its visible layout even
while its ready result is pending. SectionComposition compares that definition
before replay: a changed template receives no stale offsets and waits for its own
new compiled result. This does not write chapter content or change editor history.
The same composition comparison also avoids redundant shell remounts.

`HIGHTEX_GENERATED_FLOW=1` checks real ID/EN abstract templates with long keywords
and a long title, unchanged text/source, equivalent replay geometry, gap cleanup
and stale-definition handling. `HIGHTEX_GENERATED_LIVE=1` checks long-to-short
metadata on the active abstract editor, including unchanged selection/history and
chapter IDB. These are bounded DOM/editor checks; native PDF, arbitrary generated
structures, performance and full acceptance remain separate.

### Generated template widths and overflow diagnostics

Generated indexes and bibliography retain TemplateSectionRenderer's native column
fragmentation and their own presentation. They do not pass through an editor.
The bounded `HIGHTEX_TEMPLATE_FLOW=1` check exercises a many-entry index, one very
long index entry, a long bibliography record and a narrow abbreviation section.

Standalone abbreviation markup exposes its existing column widths and derived
fitting tracks through a template style hook. Experimental template CSS permits
the label/value tracks to shrink and wrap within the configured content width;
their original widths remain upper limits and the separator width is retained.
The existing fixed-column fallback remains available outside that renderer.

Template overflow still rejects structurally unreliable output. Its diagnostic
now includes section ID, local page, content-relative x/y bounds, usable width/
height and a short content label, preserving the actual cause through the engine.
These checks establish bounded DOM fragmentation/width behavior, not native PDF
text multiplicity, full visual parity, performance or all generated structures.

### Native table and image visual checks

`tests/integration/editor-table-pdf.cjs` mounts content in the actual editable
NodeViews, prepares the committed source, renders it with EditorSectionRenderer,
captures captureDocumentContexts and exports through the experimental IPC/service.
It reuses `captionFlowInput` from the existing complex-table fixture owner; it
does not add a planner or a product preview.
The export/check runner lives in `editor-section-pdf.cjs`. The table entry keeps
its existing cases, while `editor-flow-pdf.cjs` supplies one mixed text/list source
to the same runner. Diagnostic text markers are inserted before the first text,
preserving authored leading hard breaks. Numbered list markers are extractable
native text; Chromium can paint disc markers as graphics, so disc appearance is
reviewed in raster output rather than inferred from text extraction.

Checks compare glyph/image/caption placement and table/row/cell/column geometry
between the editor, canonical context and native print host. Native PDF checks
include complete character multiplicity, word-marker page/positions, raster
border samples and colored image samples. Border sampling uses three points per
recorded visible solid edge and a two-pixel raster neighborhood; it is sampled
paint evidence rather than a complete pixel diff. Non-painted zero-width borders
have no meaningful ink color to compare.
For collapsed row borders, sampling excludes the interior of cells spanning that
row boundary: computed row style does not imply a line painted across a rowspan.

The shared `.page[data-pagination-surface]` owns white paper, black default ink and
table border color for editable content. It applies to canonical measurement and
print contexts too, independently of application theme. Header schema markup no
longer injects the `dark:border-white!` utility, which could win collapsed-border
painting in native PDF. Ordinary non-paginated dark editors keep their header
color through editor CSS. The experimental PDF stylesheet no longer corrects
table colors after capture. Generated/cover templates retain their own renderer
and styles.
Page-number chrome explicitly uses Times New Roman in the shared editor CSS.
Its width must not inherit the application UI font when attached to document
composition, since centered labels use that width for horizontal placement.

Export cancellation restores keyboard focus to the export button. Unexpected
cancel-IPC failures use the existing ShouldReport adapter; font-loading errors
retain their original cause. Cancellation itself remains a normal lifecycle exit.
Style/theme changes during capture are retryable EditorPDFStateError conditions,
with an instruction to export again. They are not unexpected bug reports. A
native reconstruction that no longer matches an unchanged captured snapshot
retains its existing structural/presentation guard.

Editable image NodeViews observe their own IDB image record through Dexie
liveQuery. Replacing or deleting an asset under the same ID updates the live
presentation alongside canonical resource invalidation. The NodeView allocates
the blob URL only after a record is delivered and releases its previous URL and
subscription on replacement/destruction. Late reads after unsubscribe allocate
no URL. This does not dispatch source changes or replace editor state.

Passing character/geometry checks alone does not prove that borders are painted
or that a document has no extra blank page. A trailing empty paragraph from the
editor's schema/plugins can occupy a page even when extracted text is empty;
diagnose its source range and break decision before changing source or page count.

### Chapter navigation and pagination controls

`ChapterPicker` uses the shared Command/Dialog primitives, with Mod+K, searchable
chapter/heading items, hierarchy indentation and active-chapter selection. The
sidebar and picker share `chapterOutline`, labels and `useChapterOutline`; neither
implements its own heading counter. Only an open picker mounts its graph consumers.
The active outline reads the current editor buffer through ChapterGraph's existing
extractor. Other chapters use their warmed graph. `chapter:update` already carries
the extracted graph; navigation consumers must not call `graph.sync()` again.

Graph headings carry their source path in addition to their authored ID. An
unvisited chapter can have no stored heading ID until editor hydration. Navigation
passes that path through the existing pending-target channel; the destination
resolves it against hydrated content, then scrolls to the editor-owned ID. It does
not allocate IDs or write source from the navigation UI. Existing authored IDs
remain the preferred target. `useChapterNavigation` owns chapter and heading
navigation for toolbar, picker and sidebar.

`PaginationStatus` presents page mode, readiness and diagnostics separately from
export controls. `useDocumentPDF` owns capture/print/debug request lifecycle,
cancellation, cleanup and reporting; `EditorPDFExperimental` renders that state.
Layout compilation and native printing remain with their existing owners. Control
and picker styles live under `src/css/`, outside document-content CSS.

### Live pagination orchestration

`PaginationView.update` presents the recorded state, detects source/options/context
changes and schedules work. `compileLayout` owns the asynchronous task and its
lease: prepare/compile through `compileChapter`, confirm relevance through
`canPublish`, dispatch derived state, then release the compiled result in `finally`.
Failure diagnostics and reporting stay in `reportFailure`. These methods use the
existing source/compiler/session owners; they do not introduce another planner.

Pending, compiled and failure updates share a typed `PaginationUpdate` dispatch
path with history disabled. `applyPaginationTransaction` remains the sole owner
of plugin state transitions, including retention of visible composition during
pending work. Source/options freshness, composition/font readiness and abort
checks are lifecycle requirements, rather than assertions to remove during cleanup.


Chapter targets are applied by `useChapterTarget` after the ready content mounts.
The hook waits while local pagination is pending and follows content resizing or
image loading until user interaction takes control. Cleanup cancels its animation
frame and observers. This replaces a one-shot frame scheduled before React commits
ready content; source path/ID resolution stays with the existing navigation owner.
Pending navigation parameters are consumed through their context setter rather
than mutating the shared parameter array.

`DocumentResources.prepare` embeds images in batches of four, waits for each batch
to settle before propagating a resource failure, then waits for image/font readiness
before geometry capture. Encoding and bytes are unchanged. `StylesheetSnapshot`
reuses a fingerprint only for the same captured stylesheet map and root appearance;
a CSS rebuild/failure clears that value. These are per-owner optimizations and do
not change print batch limits or native pagination.

Repeated stylesheet requests also reuse the final joined CSS string while the
stylesheet revisions remain current. A rebuild or capture failure clears that
string with the fingerprint candidate; presentation guards still run. This avoids
allocating another font-embedded CSS string per request without reusing stale CSS.
