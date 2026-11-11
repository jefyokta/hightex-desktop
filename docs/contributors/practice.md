# Contributor Practice

New contributors should start by understanding the actual project shape before
changing code. HighTex Desktop is more than a UI app; it is a desktop
application with a clear split between the Electron main process and the React
renderer, plus persistence, IPC boundaries, and document-specific business rules.

## Start with the source, not the fix

Before implementing a patch, read the relevant code and the closest contributor
notes. Good onboarding questions are:

- What module owns this behavior?
- Is the bug in the renderer, preload bridge, main process, or persistence layer?
- Is there already a helper, store, hook, or service that does the same thing?
- Are there tests or notes that define the intended contract?

For new contributors, the best habit is to read the project source first, then
make a small change that fits the existing architecture. This avoids duplicate
logic and keeps PRs aligned with the project design.

## Respect the architecture

Follow the app architecture and code design instead of introducing ad-hoc
patterns. In practice, that means:

- Keep renderer logic in `src/` and privileged operations in `electron/`.
- Use the preload bridge and typed window APIs rather than reaching into Electron
  internals from the renderer.
- Put persistence and system access in the correct service or main-process layer.
- Reuse existing UI primitives, stores, hooks, and utilities before creating new
  ones.
- Keep document behavior aligned with the thesis workflow, not a general-purpose
  editor pattern.

When a change crosses boundaries, inspect all affected layers together: the UI,
API contract, main-process handler, and data model.

## Keep scope small and reviewable

A good contributor change is easy to explain in one sentence and easy to verify.
Prefer:

- one bug fix or one feature
- one clearly defined problem
- small, focused tests
- a PR description that explains the reason and the verification

Avoid mixing unrelated cleanup, formatting churn, refactors, and dependency
upgrades in the same PR. If a refactor is necessary to support the change, keep
it tightly coupled to the fix and explain why it is required.

## Prefer project conventions over personal shortcuts

HighTex Desktop values clarity and type safety. Good practices include:

- Define explicit types instead of falling back to `any` unless there is a real,
  justified reason.
- Reuse existing types, constants, error flows, and localization helpers.
- Keep naming consistent with the surrounding module.
- Follow established patterns for state, IPC, dialogs, notifications, and error
  handling.
- Use the existing project UI system and localized strings instead of adding ad
  hoc interfaces.

If you are unsure whether a pattern is already established, search the codebase
before introducing a new abstraction.

## Verify behavior before submitting

Do not rely on code inspection alone. Validate the actual behavior affected by
your change:

- run the relevant type-check and test commands
- check the exact screens or flows affected by your change
- verify edge cases and failure states, not only the happy path
- use sample documents or safe fixtures; do not test with private academic data

Typical project checks include:

```bash
bunx tsc --noEmit
bun test
bun run lint
```

For UI changes, manually confirm the affected states, especially empty, loading,
error, and success flows. For document or persistence changes, test the relevant
save, reopen, and export behavior.

## Write tests that protect the actual behavior

Tests should capture the behavior that mattered to the change, not just the
implementation details. Prefer focused checks for:

- wrong or missing data handling
- persistence and migration behavior
- state transitions and user-visible logic
- validation and error flow

When a bug is fixed, add or update a test that would have failed before the fix.

## Documentation and PR hygiene

Good contributor habits also include writing and keeping documentation in sync:

- update the relevant contributor notes when the architecture or contract changes
- keep user-facing docs in the correct language
- describe the problem, the solution, and the verification steps in the PR
- link related issues and note any limitations or manual checks you performed

A strong PR is narrow, intentional, and easy for reviewers to validate.

## Summary

The shortest practical rule for contributors is this:

1. read the existing code and docs first
2. follow the current architecture and conventions
3. keep the change focused
4. validate the behavior with the smallest relevant checks
5. explain the change clearly in the PR

That approach keeps contributions consistent with HighTex Desktop and makes
review faster and safer for everyone.
