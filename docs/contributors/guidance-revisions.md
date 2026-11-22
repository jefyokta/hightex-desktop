# Guidance revisions and submission comparison

The desktop keeps authored drafts in workspace IndexedDB. Submission review reads
immutable server snapshots; it never imports a student's submission into the
reviewer's document library.

## Revision ownership

`shared/guidance-contract.ts` defines revision requests, source anchors, status,
events and the preload API. `GuidanceClient` checks the session and decodes remote
responses. `guidance-service.ts` supplies the existing authenticated transport;
the `hightex:guidance:*` IPC channels expose list/create/update.

The server's `GuidanceRevisions` service owns authorization, transitions and the
transaction. It uses the existing submission policy and active recipient resolver.
Revisions retain their submission and reviewer identity. Each anchor stores the
snapshot SHA-256, chapter, node path, optional authored ID and quoted source.
Creating a revision requires the original snapshot to remain available and match
that hash. Retention removes archives, not revision records or events.

- The assigned active reviewer creates instructions, resolves and reopens requests.
- The document author marks progress or readiness; readiness does not resolve a
  revision or complete the submission review.
- Both may reply while their assignment permits it. Other recipients cannot access
  a review simply because they supervise the same student.
- Writes carry a UUID and expected revision version. Repeated request identities
  reconcile with the same operation; conflicting versions return HTTP 409.

`useGuidanceRevisions` owns one target's requests and pending write identity.
Unconfirmed writes are not resubmitted automatically. Refresh checks whether the
server recorded them; an explicit retry retains the same identity. Pending write
state belongs to the mounted panel and is not a durable offline outbox.
The UI preserves instructions/replies after failure and clears access-dependent
state on authorization/session errors through the review page's existing handler.
Acknowledgement from a write, retry or refresh clears only the matching submitted
draft. Target changes isolate pending operations; a late response from another
session/document/submission cannot replace the visible state or unlock its writes.

`revisionLocations` supplies searchable paragraph/caption/figure/table/equation
locations. Source inspection requires the matching original snapshot, path, ID
and quote. It does not silently attach an old request to a changed draft. There
is no automatic migration of review anchors to a later submission.

## Comparisons

`compareDocumentModels` is the existing branch comparison algorithm extracted as
an immutable-model operation. Branch comparison still owns local export/observation.
Submission comparison supplies two verified snapshots through `SnapshotReadModel`
and `renderModel()`, supporting the existing desktop and web snapshot formats.
The authenticated snapshot envelope owns the server document identity; an archive's
internal workspace ID can differ. Both archive hashes are verified before comparison.
`DocumentComparisonDialog`, `ComparisonChapter` and `comparison-text.ts` share the
change presentation instead of implementing another diff renderer.

For a submitted version, the prior version is the immediately preceding submission
to the same recipient for the same document. A purged immediate predecessor is
reported unavailable; it is not replaced silently with an older archive.
Before submitting, a student can compare the selected linked local document with
the latest submission to the selected recipient. This follows the existing
submission rule requiring its editor to be closed, so document settings and chapter
changes have finished saving. Neither comparison modifies drafts or sync bindings.

## Reference usage

`documentReferenceUsage` is a pure index of grouped citations, reference targets and
their nested occurrences. It records source paths and authored IDs and ignores
cached numbering labels. `ReferenceUsagePanel` presents the same index for local
editing and snapshot review. The editor tab overlays its active chapter buffer on
the stored chapters without flushing, changing selection, or writing data. Source
navigation reuses the scanner's existing navigation owner.

## Advisor entry

`SubmissionOverviewProvider` reads the server's audience for dashboard navigation
and the submission overview. `/dashboard` opens supervision for an advisor; explicit
local document navigation remains available. Sidebar labels and review entry points
do not grant permissions: all remote actions remain authorized by the server.

## Verification and rollout

Focused checks cover session changes, recipient selection, snapshot identity,
grouped/nested usage, source anchors, transitions, conflicts and idempotency.
Native UI fixtures use isolated data and simulated bridges; they do not prove
connectivity to a deployed server or a packaged application.

The server change requires migration
`2026_11_22_100000_create_guidance_revisions_tables.php`. Apply it through the normal
server deployment process before enabling revisions against that server. Development
checks use SQLite in memory and fake file storage; they do not migrate the user's
application database. Older servers can continue their existing submission flow,
but their revision endpoint is unavailable.
