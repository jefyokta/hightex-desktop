# Experimental editor page view

Enable **Settings → Editor → Page view (experimental)**, either in the workspace
settings or the editor settings dialog. The preference is local application
configuration (`editor.pagination`) and defaults to false. It applies to the
active editable chapter. Frozen/generated chapters retain their existing views.

This is an experimental editor layout. **Paged.js print preview and PDF remain the
authority for final page breaks and document-wide page numbering.** The page
count displayed in the editor starts at 1 for each chapter.

## Layout rules

- A4, 30 mm margins, and a 24 CSS pixel gap between sheets. These match the
  current PDF paper size and margins; the editor gap is display-only.
- Paragraphs, code and list contents flow across pages at measured line
  boundaries. Measurements include visible inline node contents, such as tall
  fractions, rather than relying on their wrapper height. Model nodes are never
  split, so ordered-list starts, references and IDs remain intact.
- Consecutive headings stay with the first following content unit when the
  group fits on one page.
- Tables can split rows and cell contents. Continuations repeat the original
  caption and leading header rows, including merged headers. Frozen row heights
  prevent later rowspan growth from moving content on earlier pages.
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
behavior or identical editor/PDF pagination.

Run the isolated performance comparison separately from other checks:

```sh
env -u ELECTRON_RUN_AS_NODE HIGHTEX_PAGINATION_PERF=1 \
  node_modules/.bin/electron tests/integration/editor-pagination.cjs
```

It compares synchronous transaction timings with pagination off/on, measures
cold/warm layout, verifies cached/fresh plan equivalence after a paragraph edit,
and checks cancellation cleanup. It does not measure end-to-end human typing
latency or prove performance on every document.
