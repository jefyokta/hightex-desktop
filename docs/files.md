# HighTex Files

HighTex uses four file formats for storing, editing, exchanging, and archiving documents.

## `.hightex`

The main HighTex document format, stored in **JSON format**.

This is the format used internally by the editor. All supported document formats are converted to `.hightex` before being loaded into the editor.

## `.ht`

HighTex document written in the **HighTex Document Language**.

> **Status:** Currently unavailable

## `.htx`

HighTex document in an **XML-like format**.

This format must be compiled into the `.hightex` JSON format before it can be loaded by the editor.

> **Status:** Currently unavailable

## `.hts`

HighTex **snapshot document archive**.

Used to store a complete snapshot of a document together with its related resources in an archived format.
