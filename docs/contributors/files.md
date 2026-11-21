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
The notification offers an action to open it. New recovery copies are grouped in
**Recovery** in the dashboard and editor save menu, with their source path and
creation time; they do not crowd the regular document list. Copies can be opened,
exported through a save dialog, or deleted through the existing confirmation flow.
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

The save button has a menu for **Save As** (`Ctrl/Cmd+Shift+S`) and **Locate source
file**. Save As writes the same document ID to a selected path and makes it the
active file only after a successful write; the previous file remains untouched.
Canceling or failing a write preserves the current binding.

File moves are not tracked automatically. The missing-source notification offers
Locate source file, which is also available from the save menu. The selected
archive must have the same document ID. Reconnecting changes the file binding and
carries its recovery baseline forward without importing over the live editor or
marking current edits as saved. If Save discovers that the active file is missing,
it asks for a destination instead of silently recreating the old path. These
actions are available while viewing generated/static sections as well.

Before replacing an active file, `DocumentFileService` compares its current archive
revision with the version opened or last saved. A changed file offers three native
window-modal choices: save a separate copy, use the file version, or keep editing.
The copy path must differ from the source. Loading the file flushes the latest
editor and settings draft first, then reopens the renderer through the file-first
flow; any differing autosave is recovered before installation. The same behavior
applies to Save from the toolbar and Save while closing the editor. Reload waits
until the close guard completes and unlocks before replacing the renderer.

The destination revision is checked again after writing the temporary file and
before renaming it. This detects changes during serialization/writing; it is not an
OS-level lock against other applications writing concurrently with the final rename.
Save As to a different location remains the way to preserve both versions. Native
permission, full-disk, unavailable-location and write errors are returned as typed
save outcomes. A failure updating IndexedDB after the file write is reported as a
local-cache failure, with the saved file path retained.

`DocumentSaving` owns the renderer's save state across chapter navigation. The save
menu shows the active path, last save time and whether the current document matches
the saved version. References, variables, images, metadata, workspace identity and
unsaved settings participate, along with the active editor buffer. Status compares
snapshots through the shared render model rather than building a ZIP per keystroke.
External file changes are checked when saving; status is not a live file watcher.
File-path changes remain with the save/reconnect owner, so an older settings draft
cannot switch the document back to its former location after Save As.

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
