# Migrate Document Storage from IndexedDB to Filesystem

## Legacy: No File Saving

Previously, documents were stored entirely in IndexedDB.

- Documents were created and stored directly in IndexedDB.
- IndexedDB was the source of truth.
- There was no concept of an original `.hightex` file.
- `src/pages/local.tsx` displayed documents directly from IndexedDB.

---

## New Flow: File-First Storage

The filesystem becomes the source of truth for documents.

When opening a `.hightex` file:

1. Open the `.hightex` file from the filesystem.
2. Extract/import its contents into IndexedDB.
3. Open the editor using the IndexedDB data.
4. IndexedDB acts as the working/cache storage while the document is being edited.

### Saving

The editor now has an explicit **Save** action.

When the user saves:

```text
IndexedDB
   ↓
Export document
   ↓
exdoc.hightex.tmp
   ↓
Validate / ensure export succeeded
   ↓
Rename temporary file
   ↓
Overwrite original .hightex