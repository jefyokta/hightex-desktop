# Proposed study-program scoping

Status: design preparation. The runtime directory is currently schema 1 and
scoped by API source only. This document describes the next contract; it does
not claim that program filtering, profile context, or release enforcement is
already implemented.

## Stable identity

Use stable machine identifiers, separate from editable display names:

```json
{
  "institution_id": "uin-suska-riau",
  "study_program_id": "sistem-informasi"
}
```

These values identify the current deployment's program. Confirm the identifiers
when creating the backend master records. Names, faculty labels, logos, and
letterheads are display/preset data rather than cache keys.

The desktop initially enables only the existing Information Systems program.
No extra program selector is needed while only one program is enabled.

## Backend ownership and membership

Introduce institution and study-program master records. Associate lecturers
with eligible programs through a many-to-many membership, not a single home
program field. A lecturer may legitimately teach or examine across programs;
such access must be represented as an approved membership in the target pool.

The public directory must query both approved lecturer status and membership
in the requested program. Unknown, disabled, or missing scope must fail rather
than silently return the global lecturer list.

At the initial migration, explicitly associate the existing one-program roster
with the current program. Do not automatically attach all future lecturers to
that program. New lecturer registration requests must record the target scope
and publication consent. Approval assigns the lecturer role and eligible
program membership together.

Kaprodi and other academic officials also need scoped lookup before a second
program is enabled. The existing global `/university-data` response is not a
complete multi-program academic-data contract. Public directory scope does not
replace account/document authorization for cloud operations.

## Public directory contract

Use an explicit scope, for example:

```text
GET /api/institutions/uin-suska-riau/study-programs/sistem-informasi/lecturers
```

Return directory schema 2 with the same scope in the body:

```json
{
  "schema_version": 2,
  "scope": {
    "institution_id": "uin-suska-riau",
    "study_program_id": "sistem-informasi"
  },
  "version": "<hash of scope and directory data>",
  "data": [{ "id": "2", "name": "Formatted lecturer name", "nip": "000123" }]
}
```

The directory's schema version is independent of the `.hightex` archive schema.
Hash the scope together with the ordered public records for ETags. API responses
contain only the agreed public fields. A requested scope and returned scope
must match exactly, including for an empty directory.

## Desktop cache and installer

Partition cache, request deduplication, retry state, and freshness metadata by
the tuple `[API source, institution ID, study-program ID]`. A response from a
different scope must never be stored or displayed, and a late response after a
scope switch must be discarded.

Ship scope metadata in the installer snapshot. Use that snapshot only for its
exact source and scope. Old unscoped cache entries are not reassigned to the
currently active program; replace them with the correctly scoped installer
snapshot or a validated download. Existing document/profile values remain
intact when directory cache entries are discarded.

For every supported distribution command, the release order must be:

```text
explicit target source + institution + program
    -> fetch the scoped API
    -> validate schema, scope, and records
    -> atomically write the installer snapshot
    -> compile renderer/main/preload
    -> package or publish the installer
```

A failed download or wrong scope must stop distribution, with no silent reuse
of the previously committed snapshot. Fetching after Vite has embedded the JSON
would be too late. Development checks need not require network access.

Artisan is an optional direct database export tool, not a self-HTTP fetch or a
required distribution step. If retained, it must require and filter by the same
scope. Distribution consumes the server API.

At runtime, directory lookup remains offline first. Conditional background
updates affect only the selected scope and never rewrite stored document
profiles automatically.

## Profile and portable document context

Prepare an optional `profile.academicContext` containing the stable institution
and study-program identifiers. The default local profile carries its selected
context. A document copies and retains its own profile context. Switching the
local profile or directory must not move existing documents into another
program.

Add and validate this optional field in the importer before relying on it in
desktop exports. Importer 0.2.0 currently discards unrecognized profile fields.
Use one shared context type, as with `AcademicCommittee`; do not duplicate the
contract in each application. An additive optional field can retain archive
schema 2 while requiring a new importer package version.

An old archive with no context remains explicitly unscoped. Preserve its author,
lecturer snapshots, and content. Never assign the viewer's active program or
fetch its academic officials into an unrelated legacy document automatically.
Resolve missing context explicitly before program-dependent synchronization.

Academic context and lecturer assignments belong in profile, not document
config. Config continues to hold document-level settings and recorded dates.

## Forms and templates

Select form catalogs, templates, and institution branding through a program
preset registry. Initially the registry contains only the current program.
A different program must not silently receive the current UIN letterhead and
TA form catalog. Directory support alone does not mean its forms are supported.
Unsupported program forms should be identified clearly while preserving normal
document viewing and existing recorded data.

## Implementation order and verification

1. Add program master records and lecturer memberships; migrate the existing
   roster once into the current program.
2. Implement explicitly scoped API responses and scoped academic officials.
3. Add validated profile context to the importer and update the desktop package.
4. Partition directory cache and installer metadata; reject wrong-scope data.
5. Require a fresh scoped download before distribution compilation/packaging.
6. Route program-dependent forms through the preset registry, keeping one
   enabled program until the next preset is actually ready.

Required regression cases include two programs sharing one backend, one
lecturer eligible in both, a lecturer belonging only to the other program,
identical rosters in different scopes, an offline restart after switching
scope, a late response from the previous scope, a wrong-scope installer payload,
a distribution fetch failure, preserved legacy profiles without context, and
an unsupported program's form request.
