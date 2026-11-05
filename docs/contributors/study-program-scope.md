# Proposed study-program scoping

Status: design preparation for academic context and forms. The desktop lecturer
directory is now user-managed local data; see lecturer-directory.md. There is no
public directory download or installer roster. The remaining program-context
work below is not yet implemented.

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

Authenticated academic data must be restricted by account/document authorization
and the institution/program of the document. Program membership alone must not
grant access to all lecturer staff numbers. Unknown or disabled scope must fail
without returning an institution-wide roster.

Kaprodi and other academic officials also need scoped lookup before a second
program is enabled. The existing global `/university-data` response is not a
complete multi-program academic-data contract.

## Local directory and installer

Desktop users manage their own local entries, independently of server and account.
Local directory IDs are not backend lecturer IDs. Server academic assignments
are never automatically copied into this list.

No lecturer snapshot is downloaded or shipped during distribution. Program
metadata for templates and academic context can be shipped without a staff roster.

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

1. Add program master records and explicitly approved lecturer memberships.
2. Scope authenticated academic assignments and officials by account/document.
3. Add validated profile context to the importer and update the desktop package.
4. Route program-dependent forms through the preset registry, keeping one
   enabled program until the next preset is ready.

Required regression cases include cross-program academic access rejection,
switching accounts/scopes during a pending request, preserved legacy profiles
without context, a local directory that remains independent of cloud accounts,
and unsupported program forms.
