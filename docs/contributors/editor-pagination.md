# Experimental editor page view

Enable **Settings → Editor → Page view (experimental)**, either in the workspace
settings or the editor settings dialog. The preference is local application
configuration (`editor.pagination`) and defaults to false. It applies to the
active editable chapter. Frozen/generated chapters retain their existing views.

This is an editor layout prototype. **Paged.js print preview and PDF remain the
authority for final page breaks and document-wide page numbering.** The page
count displayed in the editor starts at 1 for each chapter.

## Layout rules

- A4, 30 mm margins, and a 24 CSS pixel gap between sheets. These match the
  current PDF paper size and margins; the editor gap is display-only.
- Top-level paragraphs with uniform line heights can flow across pages at
  measured line boundaries. Their model nodes are never split.
- Consecutive headings stay with the first following content unit when the
  group fits on one page.
- Figures and their captions, tables, lists, code blocks and other top-level
  blocks stay together when they fit within a page's content area.
- A paragraph with variable-height line boxes is kept as a block.
- If any indivisible block is taller than the usable page height, the whole
  chapter falls back to continuous view with an explanation. Editing remains
  available. Removing or resizing the oversized block re-enables page layout.

This prototype does not split table rows or lists across pages, repeat table
headers, implement widow/orphan rules, or calculate the preceding chapters'
page offsets. The editor's node views also differ from compiler-resolved
citations, references, equations and generated content. Therefore matching the
paper dimensions does not establish parity with Paged.js.

## Document and editor lifecycle

`src/editor/pagination/` contains the pure layout planner, rendered DOM
measurement, and a Tiptap extension. The extension is added only by the live
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

Layout is recalculated after a short debounce following document edits,
rendered node-view changes, resizes, font loading or image loading. Measurement
waits until composition has ended. Switching chapters, disabling the mode and
destroying the editor remove page chrome and release subscriptions/timers.

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
image/caption layout, tables, inline node views, oversized-block fallback,
recovery, light/dark appearance and the production editor's settings and
chapter lifecycle. It writes screenshots to the temporary artifact directory.

These checks have been exercised on macOS. They do not establish Windows/Linux
behavior or identical editor/PDF pagination.
