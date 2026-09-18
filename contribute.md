# Contributing Guide

Thank you for contributing to **HighTex Desktop**. Please follow the conventions below to keep the codebase consistent, maintainable, and easy to review.
## Pinned

Please stop prompting such like `find any issue in this project and make a PR to fix it` to your agent!

It's not forbidden to use AI, but please make sure you really understand the problem and how it should be fixed before making a PR.


## Code Quality

### Always Use Types

This project uses **TypeScript**.

- Always define types for function parameters and return values.
- Avoid `any` unless there is a specific and justified reason.
- Prefer existing types over creating duplicate or equivalent types.
- Keep shared types in the appropriate type/module directory.
- Do not weaken type safety just to make an implementation easier.

```ts
// Good
function getDocument(id: string): Document | undefined {
  // ...
}

// Avoid
function getDocument(id: any): any {
  // ...
}
```

### Follow DRY

**Don't Repeat Yourself.**

- Do not duplicate the same logic across multiple components or services.
- Extract reusable logic when it has a clear and meaningful responsibility.
- Reuse existing utilities, hooks, services, and types before creating new ones.
- Avoid premature abstractions when code is only coincidentally similar.

### Keep Responsibilities Focused

Each file, class, function, and component should have a clear purpose.

- Avoid **God Objects**.
- Split large files when they start handling multiple responsibilities.
- Prefer small, focused modules over large files containing unrelated logic.
- A file should be easy to describe in one sentence.

If a class or component becomes difficult to understand or maintain, consider splitting it into smaller modules.

## Project Structure

Put files in the folder that matches their responsibility.

Before creating a new file:

1. Check whether an existing module already provides the required functionality.
2. Check the existing folder structure.
3. Place the new file beside related functionality.
4. Avoid creating unnecessary top-level folders.

Do not place files in convenient locations simply because they are easy to import.

## Naming Conventions

Use clear and consistent names.

### General Rules

- Names should describe **what something represents or does**.
- Functions should describe an **action**.
- Variables should describe the **value they contain**.
- Classes should describe the **thing or responsibility they represent**.
- Types and interfaces should describe the **shape or concept they represent**.
- Avoid vague names such as `data`, `thing`, `helper`, `utils`, or `manager` unless their meaning is genuinely clear from context.

```ts
// Good
const documentSettings = ...
function loadProjectSettings() { ... }

// Avoid
const data = ...
function handleData() { ... }
```

Use the existing naming style of the surrounding module instead of introducing a different convention.

## Components

For React components:

- Keep components focused on their UI responsibility.
- Extract reusable logic into hooks or services when appropriate.
- Avoid putting application/business logic directly into large UI components.
- Keep component files reasonably small.
- Reuse existing UI components before creating new ones.

Do not create a new abstraction only for the sake of abstraction.

## Services

Application and integration logic should live in the appropriate service/module rather than being duplicated across components.

For example:

- Electron-specific functionality belongs in the appropriate Electron layer.
- Project/document operations belong in their corresponding service.
- Persistence/database operations should not be scattered throughout UI components.
- External integrations should have a clear boundary.

Components should consume these services rather than reimplementing their logic.

## Types

Prefer centralized and reusable types when a type is shared across multiple modules.

For HighTex Desktop:

- Keep shared application types in the project's designated `types` directory.
- Do not duplicate the same type definition in multiple components.
- Use specific types instead of broad objects.

```ts
// Good
type ProjectType = "thesis" | "proposal" | "intern";

// Avoid
type ProjectType = string;
```

When extending an existing data structure, reuse or compose the existing type where possible.

## HighTex Desktop Specific Rules

HighTex Desktop is an **Electron + React + TypeScript** application. Keep the separation between the different application environments clear.

### Electron vs Renderer

Do not unnecessarily mix Electron/main-process code with renderer code.

- Electron-specific APIs belong in the main/preload side.
- Renderer code should communicate through the existing preload/API boundary.
- Do not access Node/Electron APIs directly from React components unless the project's architecture explicitly allows it.
- Reuse the existing `window.*` APIs exposed by the preload layer.

### IPC and Window APIs

When adding Electron functionality:

- Follow the existing IPC/preload architecture.
- Keep IPC channels and exposed APIs clearly named.
- Do not expose unnecessary Node/Electron functionality to the renderer.
- Keep the API surface minimal and purposeful.
  > Note: write the api's type when u register new one

### State and Persistence

Use the existing persistence mechanisms for their intended purpose.

For example:

- Use the existing application store for application-level settings.
- Use the existing database/storage layer for persistent project data.
- Use the existing Dexie/database abstractions instead of accessing storage directly from unrelated components.

Do not introduce another state or persistence mechanism without a clear architectural reason.

### Project and Document Logic

HighTex Desktop contains multiple document types and project-specific settings.

When modifying document behavior:

- Reuse existing document/project types.
- Keep document-type-specific behavior explicit.
- Avoid duplicating logic for Thesis, Proposal, and Intern documents.
- Prefer shared abstractions when the behavior is genuinely common.
- Keep document-specific fields and behavior within their appropriate modules.

### UI Consistency

Follow the existing HighTex Desktop UI patterns.

- Reuse existing components whenever possible.
- Use the project's existing UI primitives and icons.
- Keep spacing, typography, interactions, and states consistent with the rest of the application.
- Do not introduce a new UI library for a small feature.
- Avoid browser-native `alert`, `prompt`, and `confirm` for application interactions.

New UI should feel like part of HighTex Desktop rather than an isolated feature.

## Imports

Keep imports clean and consistent.

- Remove unused imports.
- Prefer the project's existing import aliases.
- Avoid unnecessarily long relative import paths when an established alias exists.
- Do not introduce circular dependencies.

## Error Handling

Handle errors intentionally.

- Do not silently swallow errors.
- Do not use empty `catch` blocks unless there is a documented reason.
- Provide meaningful error handling at the appropriate layer.
- Do not expose internal implementation details to users unnecessarily.

```ts
try {
  await saveProject(project);
} catch (error) {
  throw new ShouldNotified("Failed to save project");
  //would be better using locale message
  //        throw new ShouldNotified(t("failed.save_project"))

  // Handle the error appropriately.
}
```

### Error Contracts

all errors that extend `ApplicationError` will be cathed. this is base error class for all contracts

```ts
new ShouldNotified(); // throwing this or extend of this, will spawn a sooner with the error message

new ShouldReport(); // for very unexpected errors, it also extend should notified and will suggest user to report it into an issue

new ShouldNavigated(); // using this for avoid forbids page or any others that should navigate after errors occured

new ShouldNotifiedWithNativeComponent(); // similliar with should notified buat using os alert: used when the error will broke css
```

## Comments

Write comments to explain **why**, not what the code obviously does.

```ts
// Good
// Keep the previous value because the updater may restart the application
// before the new state is persisted.
const previousVersion = currentVersion;
```

Avoid comments that simply restate the code.

```ts
// Avoid
// Set current version
const currentVersion = version;
```

If code requires extensive comments to explain what it does, consider whether the implementation can be simplified.

> Thanks,
> jefyokta
