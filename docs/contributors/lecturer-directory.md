# Local lecturer directory

Desktop users manage their own directory on their device. A fresh installation
starts empty. There is no bundled roster, public directory request, background
refresh or automatic directory upload. Manual entries and JSON imports do not
require an account; Cloud downloads require authentication.

## Managing and selecting lecturers

The standalone **Lecturer directory / Data dosen** page at
`/dashboard/lecturers` is linked from the sidebar and the advisor picker.
It includes name/NIP search, source filtering, add, edit, delete, JSON import,
and explicit authenticated Cloud downloads.
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

The preload API exposes `list`, `save`, `remove`, `import`, and `fetchCloud` through
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

## Authenticated Cloud download

The Data dosen page includes **Get from Cloud / Ambil dari Cloud**. Logged-out
users see **Log in and get lecturers / Login dan ambil data dosen**, with an
explanation that login is needed to get server data and downloaded rows work
offline. The existing authentication modal is reused. Successful login resumes
that explicit request; cancelling login or merely opening the page does not
download anything. Offline mode disables only the Cloud action.

The main process sends the captured session's Bearer token to the configured
server's `/api/lecturers` endpoint. Tokens never enter the renderer. Redirects
are rejected, requests time out after 15 seconds, and responses are bounded to
16 MiB while streaming. Response bodies and credentials are not logged by this flow.

The contract is `{schema_version:1, version:<64-character hex>, data:[{id,name,nip}]}`.
Every row is validated before a single transaction appends new entries. Server IDs
are validated but not reused as local or document assignment IDs. Name and
non-empty string NIP are required. A legitimate empty directory is accepted.

Repeated downloads skip existing NIPs, including locally corrected Cloud rows,
manual entries, and file imports. This is an append operation, not a mirror or
automatic update: it never overwrites corrections or deletes local entries.
Results report added/skipped counts. Database/profile/document copies remain
independent. Data remains available offline after logout and restart.

The current account, server, token, and session generation must match before
any result is committed. Late responses after logout or an account/server/token
switch are discarded. Overlapping requests for the same session share a fetch.
A 401 clears that failed session and asks for login; 403 reports denied access.
HTTP/network/validation/storage failures preserve the existing directory.

Backend authorization determines which lecturers an account may receive.
Desktop does not bypass permissions, alter that access policy, or infer that
requiring login establishes the legal basis for data distribution.

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
create or relabel a cloud source. Authenticated downloads assign Cloud provenance
and the configured endpoint URL automatically. No background download is added.

## Cloud documents

Authenticated academic data remains a separate flow. Cloud assignments are
not automatically imported into the local directory. Local edits do not change
cloud assignments. Document exports may contain their recorded names/NIPs.
This desktop change does not disable deployed backend endpoints.

## Verification

Run `bun test tests/lecturer-directory.test.ts tests/lecturer-cloud.test.ts` for validation, merge behavior,
large imports, and persistence regressions.

Run `env -u ELECTRON_RUN_AS_NODE node_modules/.bin/electron tests/integration/lecturer-directory.cjs`
for the isolated UI fixture using a temporary real SQLite database. It covers
CRUD, offline reload, source labels/URLs, hidden storage paths, required NIPs, schema migration, atomic import rollback,
JSON file selection, duplicates, pagination/search, preserved profile copies,
login intent/cancellation, Bearer-authenticated HTTP fetch, authorization failures,
response validation/size/redirect rejection, and offline Cloud persistence.
