# Contributing to HighTex Desktop

This guide is for contributors preparing a pull request for **HighTex Desktop**. It explains how to choose a change, follow the project's conventions, verify your work, and make your PR ready for review.

## Before You Start

- Read the [README](./README.md) to understand the project and its goals.
- Search existing issues and pull requests to avoid duplicating work.
- Start with a specific problem or improvement that you can explain. For a bug fix, reproduce the problem before changing the code whenever possible.
- Discuss major features, architectural changes, or new dependencies in an issue before investing in a large implementation.
- Keep each PR focused on one problem. Leave unrelated refactors, formatting changes, and dependency upgrades for separate PRs.

If you only want to report a bug or suggest a feature, use the repository's issue templates.

## Using AI in Pull Requests

AI tools are welcome, but you are responsible for every change you submit.

Do not open a PR based only on a broad prompt such as **“find any issue in this project and make a PR to fix it.”** First confirm that the problem exists, understand its impact, and decide whether the proposed fix fits the project.

Before submitting AI-assisted work:

- Read and understand the generated code, tests, and documentation.
- Check that the proposed fix addresses the actual problem and follows the existing architecture.
- Remove unrelated edits, unnecessary abstractions, invented APIs, and unsupported claims.
- Run the relevant checks and manually verify affected behavior where needed.
- Be prepared to explain your implementation, its tradeoffs, and the evidence that it works.

An AI-generated explanation or a successful tool run alone is not enough to establish that a change is correct. Your PR description should reflect what you personally reviewed and verified.

## Local Development

Fork the repository, clone your fork, and create a branch for your change. The project uses **Bun**, **Electron**, **React**, and **TypeScript**.

Install dependencies and start the development application:

```bash
bun install
bun run dev
```

See [package.json](./package.json) for the available scripts and [contributor documentation](./docs/contributors/readme.md) for additional project notes. Check those notes against the current implementation when working in an unfamiliar area.

## Implementation Guidelines

### Types and Naming

- Define types for function parameters and return values. Avoid `any` unless there is a specific, justified need.
- Reuse existing types instead of duplicating them or weakening type safety to make a change easier.
- Use specific unions and project types rather than broad strings where appropriate.
- Keep shared renderer types in `src/types/` and cross-process contracts in `sharable-types/` when they belong there.
- Use names that explain the value, action, or responsibility, and follow the surrounding module's naming style.

### Structure and Responsibilities

- Check for an existing component, utility, hook, service, or type before adding another one.
- Put files beside related functionality and avoid unnecessary top-level folders.
- Keep components, functions, and services focused on a clear responsibility.
- Share repeated behavior when it represents the same responsibility. Avoid abstractions based only on similar-looking code.
- Keep business logic, persistence, and external integrations in the appropriate services or modules.
- Reuse document types and shared behavior for thesis, proposal, and internship documents. Keep document-specific behavior explicit.

### Electron and IPC

- Keep Electron/main-process logic in `electron/` and React renderer code in `src/`.
- Communicate through the existing preload boundary and `window.*` APIs.
- Follow the existing handler, IPC channel, and preload registration patterns.
- Add or update the corresponding TypeScript declarations when exposing an API. Renderer window API declarations are in `src/types/global.d.ts`.
- Expose only the functionality needed by the renderer; avoid exposing unrestricted Node.js or Electron access.

### State and Persistence

- Use existing application stores for application state and settings.
- Use the existing database and storage services for persistent document data.
- Keep direct persistence access out of unrelated components.
- Introduce another state or persistence mechanism only when the existing approach cannot meet a clearly explained requirement.

### UI and Localization

- Use **shadcn/ui** as the primary UI component system. Reuse the project's components in `src/components/ui/` before adding new ones.
- Follow the existing Tailwind CSS, Radix UI, and Lucide patterns for styling, primitives, and icons.
- Keep spacing, typography, interactions, keyboard navigation, and visual states consistent with the application.
- Avoid introducing another UI library for a small feature.
- Use the existing dialogs and notifications for normal interactions rather than calling browser-native `alert`, `prompt`, or `confirm` directly.
- Use `t` from `@/utils/lang` for user-facing text. Add matching translation keys to both `src/locales/en.json` and `src/locales/id.json`.
- Use translation interpolation for dynamic values instead of concatenating translated sentences.

### Error Handling

- Handle failures intentionally. Do not silently swallow errors or leave unexplained empty `catch` blocks.
- Preserve the original error context when wrapping an error, and avoid showing internal details to users unnecessarily.
- Reuse the existing error contracts and handling flow. Renderer errors derive from `ApplicationError`; Electron-side errors use their own contracts in `electron/exception/`.
- Use localized messages for errors shown to users.

The renderer's existing contracts include:

| Contract                            | Purpose                                                                               |
| ----------------------------------- | ------------------------------------------------------------------------------------- |
| `ShouldNotified`                    | Display a toast notification.                                                         |
| `ShouldReport`                      | Display an unexpected-error notification with a report action.                        |
| `ShouldNavigated`                   | Navigate to a recovery route.                                                         |
| `ShouldNotifiedWithNativeComponent` | Use the existing native notification fallback when the normal UI cannot be relied on. |

Check the constructors and existing call sites before using these classes. Creating an error object alone does not send it through the application's error handler.

### Imports, Comments, and Formatting

- Remove unused imports, prefer existing aliases, and avoid circular dependencies.
- Write comments that explain intent or constraints that the code does not make clear.
- Follow the repository's Prettier configuration and format only the files you change.
- Keep generated build output, local configuration, credentials, and private document data out of your PR.

## Verify Your Change

For code changes, run the type check and tests used by the [Test workflow](./.github/workflows/test.yml):

```bash
bunx tsc --noEmit
bun test
```

Also run lint for code changes:

```bash
bun run lint
```

Check formatting for the files you edited, replacing the example paths:

```bash
bunx prettier --check path/to/changed-file.ts path/to/changed-file.tsx
```

- Add or update tests when they help verify changed behavior or prevent a bug from returning. Test observable behavior, including relevant failure cases.
- Manually verify editor, PDF, persistence, or platform-specific behavior affected by your change. Use sample documents instead of private thesis data.
- For UI changes, check the affected screens and include screenshots or a recording in the PR.
- Documentation-only changes need formatting and content checks; application tests are only necessary if the documented behavior also changes.
- Report the checks you ran and their results accurately. If a check fails or cannot run, explain the failure or limitation and whether it also occurs on the base branch when known.

## Open a Pull Request

Target the `main` branch and use a title that describes the change. Mark unfinished work as a draft.

Your PR description should include:

1. **Problem:** what needs to change and why. Link a related issue if one exists; for a bug, include reproduction steps.
2. **Solution:** the resulting behavior and any implementation choices that matter to review.
3. **Verification:** the exact checks or manual scenarios you ran, their results, and any limitations.
4. **Supporting details, when relevant:** screenshots, sample input/output, platform differences, data compatibility, or migration requirements.

Before requesting review:

- [ ] I understand and have reviewed every change in this PR, including any AI-generated content.
- [ ] The PR addresses a specific problem and contains no unrelated changes.
- [ ] I have followed the relevant architecture, type, UI, and localization conventions.
- [ ] I have verified the change and documented the checks and results.
- [ ] I have included supporting examples or screenshots where they help review.

Respond to review feedback with updates or an explanation of your reasoning. If the scope changes during review, update the PR title, description, and verification details to match the final implementation.

Thank you for helping improve HighTex Desktop.
