# Local lecturer directory

Desktop users manage their own directory on their device. A fresh installation
starts empty. There is no bundled roster, public directory request, background
refresh, account dependency, or automatic directory upload.

## Managing and selecting lecturers

The standalone **Lecturer directory / Data dosen** page at
`/dashboard/lecturers` is linked from the sidebar and the advisor picker.
It includes name/NIP search, source filtering, add, edit, delete, and JSON import.
Lists show 100 rows per page; searching or filtering resets the page. Picker
results are limited to 100 with a refine-search hint. There is no directory
management modal or directory list embedded in Settings.

Names include academic titles. Name and NIP/NIK are required for every new,
edited, or imported entry. NIP/NIK remains a string to preserve leading zeroes.
Previously saved rows with an empty NIP remain readable but require completion
when edited. A thesis advisor picker can
also add a missing lecturer and select the saved name/NIP immediately.
Chair and examiner pickers use the same directory. Internship advisors retain
manual fields.

Entry IDs are locally generated and prefixed with `local:`. Selecting a row
copies only its name and NIP, never a local ID into a backend assignment ID.
Editing/deleting entries does not rewrite default profiles, document profiles,
forms, or archives. Users explicitly reselect or review profile changes to
apply new values. Deleting the last entry persists an empty directory.

## SQLite storage and upgrade

The main process uses the existing local `hightex.db` SQLite database under
Electron userData. The `local_lecturers` table stores ID, name, NIP, and provenance.
Database paths and storage internals are not exposed in the UI or directory IPC.

The preload API exposes `list`, `save`, `remove`, and `import` through
validated IPC handlers. SQL uses bound parameters. Bulk imports run as one
SQLite transaction: a failure cannot leave a partially imported roster.
The directory supports up to 50,000 entries.

Earlier user-created entries in the `lecturer-directory` electron-store JSON
file are validated and migrated once into SQLite. A database marker prevents
that file from resurrecting deleted entries. The former server-downloaded
`snapshots` key is discarded, never automatically imported. Profile/document
copies are preserved. Failed legacy reads/migrations show a storage error and
can be retried without silently resetting the user's data.

The installer snapshot JSON and fetching script have been removed.
SQLite is local storage, not encryption; this feature adds no encryption.

## JSON import

Choose **Import JSON / Impor JSON** on the Data dosen page,
select a local file, review its validated entry count, then confirm import.
The file is read locally; it is not uploaded.

Accepted formats:

```json
[
  { "name": "Lecturer Alpha, M.Kom.", "nip": "000123" },
  { "name": "Lecturer Beta", "nip": "000456" }
]
```

An object with a `data` array is also accepted, including an existing directory
payload. Incoming IDs, emails, credentials, and unrelated attributes are ignored.
Name and NIP are required. NIP must be non-empty text, never a JSON number.
Files are limited to 16 MiB and 50,000 entries. Every row is validated before
anything is written.

Imports append entries without overwriting local corrections. Duplicate
NIPs are skipped. Duplicates within a file are also skipped.
The result reports added/skipped counts. This is not a file-watching or
automatic synchronization feature.

## Source metadata

Each directory row has a source separate from the local storage mechanism:

- `manual`: entered manually.
- `file`: imported from JSON, with the actual selected file's basename.
- `cloud`: cloud-origin data with its HTTP(S) source URL, displayed alongside the label.
- `unknown`: pre-existing rows whose provenance was not recorded.

Provenance is automatic and is not a form field. Manual creation always assigns
manual; JSON import assigns file and the selected filename. Manual editing
preserves the existing origin. The save IPC ignores supplied source fields.
JSON import also ignores source claims inside its payload. Source metadata is not copied into academic document profiles.

Existing SQLite tables are upgraded transactionally to add source columns;
old rows are preserved as unknown rather than assigned invented provenance.
Cloud metadata already stored on an entry is retained; the manual form cannot
create or relabel a cloud source. The Cloud label is not a request to download
an institution-wide directory. No automatic network requests are added.

## Cloud documents

Authenticated academic data remains a separate flow. Cloud assignments are
not automatically imported into the local directory. Local edits do not change
cloud assignments. Document exports may contain their recorded names/NIPs.
This desktop change does not disable deployed backend endpoints.

## Verification

Run `bun test tests/lecturer-directory.test.ts` for validation, merge behavior,
large imports, and persistence regressions.

Run `env -u ELECTRON_RUN_AS_NODE node_modules/.bin/electron tests/integration/lecturer-directory.cjs`
for the isolated UI fixture using a temporary real SQLite database. It covers
CRUD, offline reload, source labels/URLs, hidden storage paths, required NIPs, schema migration, atomic import rollback,
JSON file selection, duplicates, pagination/search, and preserved profile copies.
