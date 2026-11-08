# Contributor Documentation

This index is the starting point for engineering notes about HighTex Desktop.
For the contribution workflow, pull requests, and review checklist, see
[Contributing to HighTex Desktop](../../CONTRIBUTING.md). This page describes
where to find the code, how to verify changes, and which focused design notes
are available.

## Project at a glance

HighTex Desktop is an Electron application with a React and TypeScript renderer.
The Electron main process owns privileged operations such as filesystem access,
SQLite, windows, and network requests. Renderer features use the preload API
for those operations; they must not access Node.js or Electron internals
directly.

```text
React renderer (src/)
        │ typed window APIs
        ▼
Preload bridge (electron/preload/)
        │ validated IPC
        ▼
Electron main process (electron/)
```

The renderer also contains the document editor, compiler, forms, and workspace
features. Portable document data and desktop-only application data have
different owners and persistence rules; check the relevant domain note before
changing either.

## Source map

| Location                                                           | Responsibility                                                                             |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `src/`                                                             | React renderer, pages, UI, editor, document compiler, localization, and renderer utilities |
| `src/editor/`                                                      | Editor state, document model integration, extensions, and IndexedDB storage                |
| `src/compiler/`                                                    | Document rendering and export pipeline                                                     |
| `src/workspaces/`                                                  | Workspace state and data transfer                                                          |
| `src/components/ui/`                                               | Shared UI primitives; reuse these before adding another component library                  |
| `electron/main/`                                                   | Electron application startup and runtime                                                   |
| `electron/preload/`                                                | Narrow, typed renderer-facing API                                                          |
| `electron/handlers/`, `electron/workspaces/`, `electron/database/` | Main-process IPC handlers, workspace behavior, and SQLite persistence                      |
| `sharable-types/`, `src/types/`                                    | Shared and renderer-facing type declarations                                               |
| `tests/`                                                           | Unit tests and opt-in integration fixtures                                                 |
| `docs/`                                                            | Contributor notes and user documentation                                                   |

When adding an IPC feature, update the main-process handler, preload bridge,
renderer type declarations, and tests together. Validate inputs at the IPC
boundary and expose only the operations the renderer needs.

## Set up and run

Use Bun, install the repository dependencies, and start the development
application:

```sh
bun install
bun run dev
```

Useful checks for code changes:

```sh
bunx tsc --noEmit
bun test
bun run lint
```

Run focused tests while iterating, for example:

```sh
bun test tests/locales.test.ts
```

The CI workflow runs the type check and test suite. Integration scripts may
launch Electron, create temporary user data, or depend on platform facilities;
read the script's header and setup before running one. Do not point fixtures at
personal application data or a production account. For UI changes, manually
check the affected screen and relevant empty, loading, error, and success states.

## Engineering practices

- Keep changes focused and follow existing module boundaries and naming.
- Prefer existing hooks, services, stores, and UI primitives over duplicate
  infrastructure.
- Keep privileged access in the main process. Do not expose unrestricted
  filesystem, network, or Electron access to the renderer.
- Preserve type safety and validate data at persistence, import, and IPC
  boundaries. Surface failures through the existing error flow instead of
  silently swallowing them.
- Treat user-facing text as localized. Update both English and Indonesian
  locale files and run the locale tests.
- Add or update tests for changed behavior, especially persistence, migrations,
  failure handling, and user-visible interactions.
- Keep private documents, credentials, generated output, and local machine
  configuration out of changes.
- Write contributor documentation in English. Keep user-facing documentation
  in its intended language.

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for the full contribution and
pull-request checklist.

## Domain and implementation notes

These notes describe particular contracts and implementation areas. They
complement the code and tests; verify behavior against the current
implementation before relying on a note for a new change.

### System design

- [Code architecture](./architecture.md) — runtime processes, ownership,
  workspace isolation, editor lifecycle, and cross-cutting invariants.
- [Electron renderer and IPC boundary](./electron-ipc.md) — preload APIs,
  request handlers, event subscriptions, and boundary checks.
- [Testing and verification](./testing.md) — focused unit checks and safe
  Electron integration testing.

### Renderer and shared patterns

- [Language and locale](./lang-and-locale.md) — locale structure, translation
  keys, interpolation, and validation.
- [Frontend utilities](./front-end-utils.md) — shared dialogs and small
  renderer helpers.
- [Frontend errors](./front-end-exception.md) — renderer error contracts and
  how to select one.
- [Configuration access](./refactor.md) — reading and updating application
  configuration from renderer components.
- [Feature guides](./ui-guides.md) — adding and testing release announcements
  and guided tours.

### Documents and academic data

- [Editor and document persistence](./editor-persistence.md) — IndexedDB,
  autosave, flush, and portable archive boundaries.
- [Document rendering pipeline](./document-rendering.md) — resolver order,
  Paged.js lifecycle, and export boundary.
- [HighTex file formats](./files.md) — portable document and snapshot formats.
- [Cloud document sync policies](./cloud-document-sync-policies.md) — content
  fingerprints and cloud version behavior.
- [Committee profile migration](./committee-profile-migration.md) — committee
  assignments, legacy data, and archive compatibility.
- [Local lecturer directory](./lecturer-directory.md) — local directory
  storage, import, and explicit Cloud downloads.
- [Study-program scope](./study-program-scope.md) — a design proposal for
  future academic-context scoping; it is not a description of a completed
  feature.

## Documentation map

The [documentation home](../readme.md) links to contributor and user
documentation. User guides are maintained separately under `docs/users/`.
