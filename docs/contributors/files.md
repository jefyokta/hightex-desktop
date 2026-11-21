# HighTex Files

HighTex uses four file formats for storing, editing, exchanging, and archiving documents.

## `.hightex`

The main portable HighTex document format is a **v2 ZIP archive**, containing a
manifest, document configuration, chapters and assets. The editor stores its
working draft in IndexedDB; the archive is the source when reopening a file-backed
document.

Opening a `.hightex` routes its document ID and path to `EditorWindow`. An already
open editor is focused without replacing its draft or changing its active file.
For a new editor session, `DocumentFileSource` reads the source before mounting the
editable chapter. Chapter navigation reuses that session and never reloads the
archive over live editing. Documents without a source path and historical versions
keep their existing storage flow.

Before installing the source, a differing local autosave is preserved as a separate
document with a recovery title, its own asset ownership and no source file path.
The notification offers an action to open it, and the copy remains a separate local
document with its source path and creation time.
The file is never rewritten by opening it. A missing or unreadable source falls
back to the existing autosave with a warning. An invalid archive or a source whose
document ID changed leaves the draft intact and shows a retryable opening error.

`DocumentFileSource` records the last normalized/saved content revision in the
existing `file` table. Without a recorded revision, differing older autosaves are
conservatively recovered. File fingerprints and normalized editor fingerprints
remain separate in `EditorWindow`: asset ID remapping and editor normalization do
not cause a save prompt on a clean reopen, while changes to the source file remain
detectable. Save uses the existing atomic file write and then records the exact
saved revision. Workspace author identity and cached cloud academic ownership
retain their existing policies.

The dashboard observes the document table with Dexie `liveQuery`, so imports and
recovery copies committed in another editor window appear without an app restart.

## `.ht`

HighTex document written in the **HighTex Document Language**.

> **Status:** Currently unavailable

## `.htx`

HighTex document in an **XML-like format**.

This format must be compiled into a `.hightex` archive before it can be loaded by the editor.

> **Status:** Currently unavailable

## `.hts`

HighTex **snapshot document archive**.

Used to store a complete snapshot of a document together with its related resources in an archived format.
