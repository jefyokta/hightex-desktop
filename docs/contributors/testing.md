# Testing and Verification

Use focused tests while developing, then run the checks that cover the changed
behavior. CI currently type-checks the project and runs the Bun test suite;
lint and platform-specific checks should also be run when relevant to the
change.

## Core checks

```sh
bunx tsc --noEmit
bun test
bun run lint
```

`bun test` runs the unit suite under `tests/`. For quicker iteration, pass
specific test files:

```sh
bun test tests/ui-guides.test.ts tests/locales.test.ts
```

Use `bunx prettier --check <paths...>` for the files changed. Avoid formatting
the entire repository as part of an unrelated change.

## Pick tests by behavior

| Change                                | Useful starting points                                                                                 |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Renderer localization                 | `tests/locales.test.ts`                                                                                |
| Editor persistence and close behavior | `tests/editor-persistence.test.ts`, `tests/editor-save.test.ts`, `tests/editor-close-guard.test.ts`    |
| Import/export and document drafts     | `tests/document-drafts.test.ts`, `tests/import-conflict.test.ts`, `tests/content-fingerprint.test.ts`  |
| PDF generation                        | `tests/pdf-generation.test.ts`, `tests/print-store.test.ts`                                            |
| Workspace behavior                    | `tests/workspaces.test.ts`, `tests/lecturer-workspace-access.test.ts`                                  |
| Guided tours                          | `tests/ui-guides.test.ts`, `tests/first-installed.test.ts`                                             |
| Cloud flows                           | Relevant `cloud-*`, `account-*`, or `session-*` tests; prefer an isolated fixture over a real account. |

This table is a starting point, not a guarantee of complete coverage. Search
for tests around the changed service, contract, and failure cases before
choosing a final verification set.

## Electron integration tests

Scripts in `tests/integration/` can create windows, temporary application data,
local servers, or real SQLite databases. Read a script's header and setup before
running it; some tests require an explicit opt-in flag or a dedicated empty
test account. Use only fixture data and never point a test at a user's normal
HighTex data directory.

Many UI fixtures run Electron directly. In environments where
`ELECTRON_RUN_AS_NODE` is set, invoke them with:

```sh
env -u ELECTRON_RUN_AS_NODE ./node_modules/.bin/electron tests/integration/<test>.cjs
```

Run UI fixtures sequentially unless their instructions explicitly isolate
resources. Each test process may use fixed ports or shared Electron resources.
For network tests, use a local test server or a specifically provisioned test
account; do not place credentials or tokens in test output.

## Manual verification

For user-visible changes, exercise the affected path in the development
application with a sample document. Check relevant initial, empty, loading,
error, retry, and successful states. For persistence or migrations, verify
existing data remains intact after restart and that failure/retry does not
duplicate or silently discard data.

Document the exact commands and manual scenarios you ran. Report failures and
environment limitations accurately; a successful unit test does not establish
that a platform-specific Electron flow or visual layout was verified.
