# Editor and Document Persistence

The editor persists its working document in the renderer's IndexedDB database.
Portable `.hightex` archives are a separate interchange format; they are
created from a consistent view of the local database and are not the live
editing database.

## IndexedDB ownership

`HighTexDB` in `src/editor/storage/hightex-db.ts` is the Dexie database adapter.
It owns document metadata and related records such as chapters, references,
images, variables, aliases, and chapter graphs. Schema upgrades are versioned
in the database constructor. Existing data must be migrated deliberately rather
than cleared or reconstructed from the active user's settings.

The current schema history includes:

- Version 2 moves legacy variables into `documentVariables`, keyed by document
  and variable name.
- Version 3 migrates legacy committee assignments into the document profile.
- Version 4 adds `parentId` to document records for branch relationships.

Keep schema upgrades idempotent and safe for real user data. Add tests for both
the new data and the legacy records that must be preserved.

## Editing and autosave

`Document` warms the document model and its chapters before the editor becomes
ready. Chapter content is stored as editor JSON. The editor event setup in
`src/editor/event/index.ts` waits for the persisted chapter before making the
editor editable; only initialized editor sessions are eligible to autosave.

`Chapter.setContent` normalizes chapter content and stores it through
`Storage.setChapter`. `Storage` serializes writes to the same chapter and
provides `waitForChapter` and `waitForDocument` so callers can wait for pending
writes. Avoid writing the same chapter directly from a component or starting a
second persistence path that bypasses these guarantees.

When an editor is closed, exported, or otherwise needs a final consistent
snapshot, use the existing editor flush handshake. The main process requests a
flush from the owning editor window; the renderer waits for pending document
writes and returns the result. A failed flush, closed editor, or timeout must
remain a failure, not silently produce a stale archive.

## Document settings drafts

`useDocumentSettings` owns loading, workspace-profile/category subscriptions,
pending metadata, and saving for the editor's settings panel. The panel composes
the controls under `src/components/editor/document-settings/`; those controls
receive values and typed patches rather than database access or React setters.
Author details remain a read-only view of the workspace profile. Cloud academic
locks and source-file ownership remain enforced by their existing services.

Unsaved settings register in `documentDrafts` so archive capture can include
them without silently committing the panel. Cleanup removes only the draft
registered by that hook instance. The saved baseline retains a typed document;
profile refresh updates both the editable copy and baseline, without making a
clean panel dirty or discarding metadata edits. A completed save accepts its
captured document as the baseline; edits made during that write remain pending.

## Citation library

`ReferenceRepository` in `src/editor/storage/reference-repository.ts` owns
reference reads, imports, author updates, usage checks and safe deletion.
Imports reserve keys in one transaction. Explicit imports retain separate keys;
inline Zotero selection may reuse an existing key only when the parsed publication
metadata is equivalent, excluding citation identifiers and parser provenance.
Matching a DOI alone does not establish equivalence or rewrite existing records.

`useReferenceCatalog` subscribes to those reads with Dexie `liveQuery` and builds
the shared search index. The dashboard, sidebar and pickers update after reference
writes without a second manual reload path. Failed parsing exposes a retryable
load error and leaves stored records intact. Reading never deletes malformed
references. `useCitationLibrary` owns library actions and their user feedback.

Before usage checks or deletion, the repository flushes open document chapter
buffers through the existing editor bridge. Usage includes grouped citations and
nested content across all locally stored chapters. Deletion rechecks usage in its
write transaction after confirmation. Failed flushes prevent deletion. This
protects the flushed/persisted state; it is not a workspace-wide editing lock.

`ReferencePicker` renders the shared search input and results in the caret popup,
insertion dialog and citation popover. `useReferencePicker` owns merging the local
and Zotero result sets, keyboard selection, import-before-insertion and pending
selection invalidation. The component receives a consistent result shape with its
source, key, title and description instead of interpreting storage/network records.
Local search ranks tokens across
title, author/editor, year, DOI and stored key, ignoring case and accents. Enabled
Zotero search uses its local API independently of the first imported item list,
with a debounce and stale-response suppression; unavailable Zotero does not block
local results. Selecting a Zotero result stores/reuses its reference before
insertion. Closing the picker or changing its query invalidates pending selection.
`ReferenceSuggestion` owns the caret popup's local search input state, so typing
there does not write search text into the document. Its content has a bounded
width inside the managed Tiptap mount, whose outer width is `max-content`;
Floating UI shifts the popup inside the viewport. Editor typing still updates the
query; Arrow/Enter work from either the editor or search input, and Escape from
the input closes the suggestion and returns focus to the editor.
The insertion dialog preserves its opening selection and does not insert into a
different document state. Pending network requests are not aborted by the picker.

The library surfaces share `useBibtexImport`, `useZoteroImport`, and the import dialogs
under `src/components/citation/`. Zotero uses the root config and selection
providers. Pending imports prevent repeated submissions and keep their dialog
open until the operation completes. Dialogs respect the editor titlebar bounds.
The Zotero import dialog has its own search input and can find items beyond its
initial list. Zotero item/connection payloads share `shared/zotero-contract.ts`
across the renderer and preload API.
`ZoteroHandler` only binds IPC channels; `ZoteroService` owns endpoint-specific HTTP
requests and response handling. Connection probes return their existing status
payload; item/search/BibTeX requests retain their HTTP or network failures. The
service accepts a fetch adapter for isolated checks without a running Zotero server.

`useCitationAuthors` owns the author-editing interaction. Its conversion helpers
in `utils/citation-authors.ts` handle person and organization names, preserving
publication fields; the library updates the original record key and ownership.
The editor's citation cards retain their narrative/parenthetical copy commands,
and use `formatCitationBibliography` from the existing citation formatter.

## Archive import and export

`HighTexImporter` uses the importer package to validate/read an archive, then
prepares and installs the result through the desktop persistence adapter.
`Exporter` reads the document and its related records in one IndexedDB read
transaction before writing the archive. Keep importer parsing and desktop
database responsibilities separate.

Import overwrite and copy are different operations: overwrite targets the
archive document ID; copy creates a new local ID and title. Import preparation
captures the prior draft so failed installs can preserve existing data. The
archive writer must not accidentally include unrelated documents' images,
variables, citations, or aliases.

Workspace transfer snapshots are another distinct format. Their encoder
preserves values such as `Blob`, `Date`, and `Uint8Array`; restoration checks
table names and writes all tables transactionally. Do not treat a workspace
snapshot as a portable document archive.

## Data integrity checklist

- Add migrations instead of deleting or resetting existing databases.
- Keep document-scoped records scoped by document ID.
- Use transactions when multiple related tables must change together.
- Wait for pending chapter writes before producing a final document snapshot.
- Preserve author/profile, committee, cloud academic, and branch semantics at
  their existing boundaries; do not substitute active account data for stored
  document data without an explicit product rule.
- Test reopen, import/export round trips, interrupted writes, and rollback or
  failure behavior for persistence changes.

## Related tests

Start with the tests closest to the behavior being changed:

```sh
bun test tests/editor-persistence.test.ts tests/editor-save.test.ts tests/editor-export-flush.test.ts
bun test tests/document-drafts.test.ts tests/document-profile.test.ts
```

Test names and coverage evolve; inspect the current suite before relying on
these commands as exhaustive coverage.
