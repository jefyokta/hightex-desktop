# Renderer Configuration Access

Renderer components should use the existing configuration context and
`useConfig` hook when they need application configuration:

```tsx
import { useConfig } from "@/hooks/use-config";

function Example() {
  const { config, saveConfig } = useConfig();
  // Read the current context value and persist updates through the provided API.
}
```

This keeps React components connected to the shared configuration state and
uses the existing update path. Avoid adding direct configuration reads or writes
to ordinary components. When a non-component utility or a flow with a specific
readiness requirement must use the preload API, follow the nearest established
pattern and keep access behind a focused helper or context boundary.

Configuration is exposed to the renderer through the preload API; do not access
Electron or persistent storage directly from renderer code.
