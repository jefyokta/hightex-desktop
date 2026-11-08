# Frontend Utilities

Use shared helpers for common renderer interactions rather than introducing
another dialog or duplicating small formatting behavior.

## Confirmation dialogs

`confirm` from `@/utils/confirm` returns `Promise<boolean>`:

```ts
import { confirm } from "@/utils/confirm";
import { t } from "@/utils/lang";

if (
  await confirm({
    title: t("example.delete_title"),
    desc: t("example.delete_description"),
  })
) {
  await deleteItem();
}
```

Use localized text for dialog titles, descriptions, and button labels. A
cancelled confirmation resolves to `false`.

For operations that need a third result, use `confirmWithAlternative`; it
returns `true`, `false`, or `"alternative"`. The `@Confirm` method decorator is
also available for methods that return a promise. Check existing call sites and
the decorator's behavior before using it: declining returns `undefined` without
calling the decorated method.

These helpers require the application confirmation provider to be mounted.
They throw an error if used outside that application context.

## Ask dialogs

`ask` from `@/utils/ask` displays the shared text-entry dialog and resolves to
`string | undefined`. `undefined` means the request was cancelled:

```ts
import { ask } from "@/utils/ask";

const value = await ask({
  title: t("example.enter_name"),
  placeholder: t("example.name_placeholder"),
});
if (value === undefined) return;
```

Use the options form when a placeholder, default value, custom button text, or
hidden input is needed. The provider must be mounted, or `ask` throws.

## Small formatting helpers

- `truncate(text, max?)` shortens text longer than `max` and appends `...`.
  The default maximum is 30 characters.
- `name(value)` returns an empty string for an empty value and otherwise ensures
  the value ends with a period.

Check the implementation and types in `src/utils/` before relying on a helper
for special Unicode, punctuation, or formatting requirements.
