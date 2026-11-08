# Language and Locale

All user-facing renderer text must use the localization system. The supported
languages are English (`en`) and Indonesian (`id`).

## Locale files and keys

Locale messages live in:

```text
src/locales/en.json
src/locales/id.json
```

Both files must have the same keys and matching interpolation parameters. Use
descriptive, hierarchical keys grouped by feature, such as
`workspace_profiles.migration_title`.

The `LocaleKey` type in `src/utils/lang.ts` is derived from the English locale,
so known keys are checked by TypeScript. Do not add a visible string directly
to a component when it should be translated.

## Use translations

Import `t` from `@/utils/lang`:

```tsx
import { t } from "@/utils/lang";

export function SaveButton() {
  return <button>{t("common.save")}</button>;
}
```

Use `{name}` placeholders for dynamic values. Pass the value as the second
argument instead of assembling a translated sentence in code:

```json
{
  "greeting": "Hello, {name}"
}
```

```ts
t("example.greeting", { name: userName });
```

Keep interpolation names aligned between both locales. Values are converted to
strings by the translation helper; `null` and `undefined` values render as an
empty string.

## Add or change a message

1. Add the same key to `src/locales/en.json` and `src/locales/id.json`.
2. Keep the translations natural in each language and preserve the same
   `{placeholder}` names.
3. Use `t` at the call site and provide every required interpolation value.
4. Run the focused locale tests:

   ```sh
   bun test tests/locales.test.ts
   ```

The locale tests check key parity, interpolation parity and required
interpolation arguments at statically recognizable call sites. They do not
replace a review of translation meaning or runtime checks for dynamically
constructed keys and values.

## Language preference

The application configuration stores the selected language. Use the existing
language helpers and context rather than creating component-local locale
state. Keep contributor-facing documentation in English; user guides remain
in the language appropriate to their audience.
