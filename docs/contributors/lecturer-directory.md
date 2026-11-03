# Lecturer directory and offline profiles

The desktop uses one public directory for thesis advisors, the chair, and both
examiners. Internship advisors remain manual. Selecting a lecturer copies the
formatted name and literal NIP into the existing profile fields. Committee
selections additionally keep the optional directory ID supported by importer
0.2.0. The existing flat advisor fields keep their existing archive contract.

Directory refreshes never rewrite a selected default profile, document profile,
or an existing archive. A user explicitly selects a row to use updated data.
An imported name that no longer appears in the directory remains visible and
printable. Faculty assessment fields remain blank as before.

## Backend

The sibling `hightex` backend serves `GET /api/lecturers` without login. Its
allowlisted payload is `{schema_version: 1, version, data: [{id, name, nip}]}`.
Names use the backend's existing academic-title formatter, and NIPs are
strings. Email, credentials, profile photos, and other user attributes are
never serialized by this endpoint.

Current institution lecturer accounts have the `advisor` role. Only that role
is eligible. The backend's `/register/lecturer` form collects publication consent
and stores a pending request without creating a lecturer account or directory
entry. Only super admins can review it at `/lecturer-requests` (Pengajuan Dosen).
Approval grants the role and changes the directory ETag. The full flow and
deployment migration are documented in the backend's `docs/lecturer-registration.md`.
Existing lecturer accounts remain eligible; historical consent is not fabricated.

The ETag is derived from the complete, deterministically ordered directory.
Name/NIP/title edits, additions, role removal, and account deletion invalidate
it. An unchanged directory responds with 304. The existing authenticated
`/api/advisors/sync` endpoint retains its original access policy.

## Installer and cache

`src/assets/data/lecturer-directory.json` is embedded in the main-process
bundle. A fresh installation can select lecturers without an initial network
connection. The snapshot records its API source and generation time; it is
used only for the matching server. Development or custom servers do not borrow
another institution's directory or IDs.

The main process stores full validated snapshots in the `lecturer-directory`
electron-store, partitioned by API base URL. Rendering/searching uses saved data
immediately. No session token or cookie is sent when updating this public data.

Background checks run on initial use, opening the picker, window focus, or a
network-online event. Successful checks are reused for 24 hours; failed checks
back off for five minutes. The explicit refresh button bypasses those ages.
Overlapping requests share a single refresh.

A 200 response replaces the full cache atomically after validation, including
removals and a legitimate empty directory. A 304 updates the check time.
Network, HTTP, malformed-response, or storage failures preserve the previous
snapshot. An empty saved directory takes precedence over the installer seed,
so removed lecturers are not restored from the seed after restart.

Offline operation uses the latest downloaded data or installer snapshot. It
cannot reflect a later server change until another successful update. Copies
already stored in academic documents retain their recorded values.

## Refreshing an installer snapshot

From the backend, read its current approved lecturer accounts directly:

```sh
php artisan hightex:lecturer-snapshot \
  --output=/path/to/hightex-desktop/src/assets/data/lecturer-directory.json \
  --source=https://hightex.jefyokta.dev/api/
```

After deploying the public endpoint, desktop maintainers can also fetch it:

```sh
bun scripts/update-lecturer-directory.ts --source https://hightex.jefyokta.dev
```

Review and commit the updated snapshot before building an installer. Runtime
updates work independently of desktop releases; rebuilding is only needed to
refresh the first-launch snapshot shipped to new installations.
