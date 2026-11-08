# Frontend Error Handling

Use the renderer error contracts in `src/exception/` to communicate the
intended outcome to the application's existing error handling flow. Creating
or throwing an error does not itself show a notification unless the error is
handled by that flow.

## Choose the intended behavior

| Contract                            | Use when                                                                                              |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `ShouldNotified`                    | The user needs a warning or error notification for an expected, actionable problem.                   |
| `ShouldReport`                      | An unexpected failure should be shown as an error and offer the existing report action.               |
| `ShouldNavigated`                   | The application should navigate to a recovery route after handling the failure.                       |
| `ShouldNotifiedWithNativeComponent` | The normal renderer notification UI cannot be relied on and the existing native fallback is required. |
| `ApplicationError`                  | A domain-specific error needs a recognizable type but no special display behavior.                    |

For example:

```ts
import { ShouldNotified } from "@/exception/interfaces/should-notified";
import { t } from "@/utils/lang";

throw new ShouldNotified(t("error.document.not_found"));
```

`ShouldNotified` accepts a description string or an options object with
`message`, `description`, and an optional action. Follow nearby examples to
match the intended notification level and presentation.

## Preserve useful error information

- Handle errors at the appropriate boundary and retain the original cause when
  wrapping an unexpected failure.
- Do not silently catch and discard errors. If an operation can fail, surface
  the failure through the established contract or return a documented result.
- Avoid exposing stack traces, credentials, or internal implementation details
  in user-facing messages.
- Localize messages shown to users.
- Do not assume that merely constructing an error object triggers navigation,
  notification, or reporting; use the existing application handling path.

Electron main-process failures have separate contracts under
`electron/exception/`. Use the main-process pattern for main-process code and
the preload/IPC error handling already in place; do not throw renderer-only
contracts across process boundaries without following that contract.
