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
bun test tests/document-drafts.test.ts tests/import-conflict.test.ts
```

Test names and coverage evolve; inspect the current suite before relying on
these commands as exhaustive coverage.
