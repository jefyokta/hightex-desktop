# Document Rendering Pipeline

HighTex renders documents in the browser rather than compiling LaTeX. The
renderer builds source content from a document model, resolves document
features, paginates the result with Paged.js, and then coordinates export with
the Electron main process.

## Pipeline overview

1. A printable view waits until its document and author profile are ready.
2. `Engine` receives a parser context, output elements, and rendering options.
   The parser can process a single chapter or a full document.
3. `EnginePipeline` warms shared reference data and runs resolvers in order:
   parser, static chapters, code blocks, KaTeX, headings, captions, citations,
   links, variables, images, DOM preprocessing, and tree processing.
4. `Engine.createPaged` waits for print images and fonts, then runs the Paged.js
   previewer into the output element.
5. Full-document renders update table-of-figures and table-of-contents page
   numbers, finish the CV page, notify the renderer, and publish export
   metadata to the main process.

The resolver order is defined in
`src/compiler/engine/engine-pipeline.ts`. A resolver can depend on output
created by earlier steps, so ordering changes require tests and visual
verification.

## Modes and lifecycle

- **Full mode** renders a document, including its static pages and document-wide
  navigation metadata.
- **Single mode** renders a chapter without producing the full-document export
  payload.

The printable views create an engine for the current render and destroy it
during effect cleanup. The engine checks its active state between asynchronous
steps so an obsolete render cannot continue after its view is replaced.
Preserve this cancellation behavior when adding asynchronous resource work.

Print routes may run in an editor iframe or a dedicated PDF window, with
different API availability and initialization. See
[IPC APIs in iframes](./iframe-ipc.md) before adding `window.*` API dependencies
to printable views, resolvers, or their shared helpers.

The engine waits for fonts and image resources before pagination and before
signaling completion. If a render fails, report it through the existing print
error path. Do not treat a partially rendered page as a successful export.

## Export boundary

The renderer sends a document-scoped payload using the channels created by
`src/utils/print-request.ts`. Electron's PDF service coordinates the print
window and its request lifecycle. Keep renderer layout work and main-process
file writing in their respective processes; avoid saving files directly from
the renderer.

Progress and completion events must remain associated with the matching
document/request so concurrent exports cannot consume each other's results.
When changing export behavior, cover failures, cancellation, timeout, and
window cleanup in addition to the successful PDF case.

## How to verify rendering changes

- Run relevant unit tests, including `tests/pdf-generation.test.ts` and
  `tests/print-store.test.ts`.
- Check both a single chapter and a full document when the changed resolver
  affects both.
- Verify images and fonts have loaded before assessing pagination.
- Compare output page counts, page breaks, table of contents, figure/table
  lists, references, and CV/profile content where relevant.
- Test cancellation or a failed resource load for new asynchronous behavior.
- Use a fixture or sample document, not a contributor's private document.

Visual layout can depend on fonts, browser version, and platform. Record the
environment and distinguish a rendering regression from an environment-only
difference when reporting results.
