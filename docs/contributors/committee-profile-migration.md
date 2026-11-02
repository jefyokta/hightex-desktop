# Committee assignments in author profiles

Chair and examiner assignments now belong to `AuthorProfile.committee`:

```json
{
  "committee": {
    "chair": { "id": "17", "name": "Chair, M.Kom.", "nip": "000017" },
    "examiner1": { "name": "Legacy Examiner", "nip": "" }
  }
}
```

The type and validation contract come from `@hightex/importer` 0.2.0.
Directory IDs are optional, and NIP/NIK remains a string to preserve leading
zeros. Advisor fields retain their existing representation. Faculty officials,
internship settings, and dates remain in document configuration.

## Migration

IndexedDB version 3 migrates each document independently. The same pure
`migrateDocumentCommittee` helper handles imported v2 archives and read-only
snapshot interpretation:

| Legacy config | Profile committee |
| ------------- | ----------------- |
| `leader`      | `chair`           |
| `member_1`    | `examiner1`       |
| `member_2`    | `examiner2`       |

Known names are retained with an empty NIP and no directory ID. The migration
does not request a server, match names to directory records, or read the active
user's default profile. Author identity, CV, picture, dates, and other config
are preserved. A missing author remains missing unless there are assignments
to carry over, in which case an incomplete author profile holds them.

A present `committee` object is authoritative, including `{}`. Omitted roles
in that object represent empty assignments. Legacy names never refill those
roles. Runtime migrations remove the three legacy config keys and are
idempotent.

## Archive compatibility

The archive remains schema v2. `committee` is optional, so older archives
continue to parse. Import validation rejects malformed committee objects and
non-string identities.

At export only, `legacyCommitteeConfig` projects the current profile's names
into the three old config fields. This lets older applications display the
names. Older applications may discard the additional profile fields when they
save an archive; this compatibility projection cannot preserve IDs and NIPs
through an older importer. Updated clients preserve them on export/import.

The archived bytes and hash of an existing snapshot are unchanged. Its
in-memory interpretation uses the migration helper; the original file is
still available through `originalFile()`.

Cloud academic mapping retains directory IDs/NIPs when supplied, applies
assignments to profile, and keeps the existing cloud lock and ownership rules.
Legacy cloud data can still supply names. Faculty officials remain in config.

## Importer package

Importer source lives in the sibling `../hightex-impoter` repository. Desktop
uses the published npm package `@hightex/importer@0.2.0`; archive schema stays
at version 2. A clean checkout does not require the sibling repository.

To prepare a later importer change, bump its package version, run its
typecheck/tests/build, publish the new package, and update the desktop dependency:

```sh
bun add @hightex/importer@<version>
```

Directory fetching and a searchable lecturer picker are separate work. The
profile fields and optional directory IDs provide the storage contract for
that integration.
