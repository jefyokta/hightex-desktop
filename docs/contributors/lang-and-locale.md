# Localization

Avoid hardcoded user-facing text. Use the localization system instead.

## Locale Files

Locale files are stored in:

```text
src/locale/{lang}.json
```

Currently available languages:

* `id` — Indonesian
* `eng` — English

Each locale file should contain the same translation keys.

## Using Translations

Import the `t` function from `@/utils/lang`:

```tsx
import { t } from "@/utils/lang"

const MyComponent = () => {
    return <>{t("my_component.keys")}</>
}
```

Use the translation key instead of writing user-facing text directly in the component.

### Interpolation

If a translation contains a dynamic value, use `{interpolate}` in the locale file.

For example:

```json
{
    "key": "I need a {interpolate}"
}
```

Then pass the value as the second argument to `t`:

```ts
t("key", {
    interpolate: "bunch of cigarettes"
})
```

This keeps dynamic content separate from the translated text and allows the surrounding sentence to be localized properly.

## Rules

* Do not hardcode user-facing text in components.
* Add new translations to both `id.json` and `eng.json`.
* Use descriptive, hierarchical translation keys, for example:

  ```text
  my_component.title
  my_component.description
  my_component.save
  ```
* Use interpolation for dynamic values instead of constructing translated sentences in code.
