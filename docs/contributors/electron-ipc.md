# Electron Renderer and IPC Boundary

The renderer runs with context isolation and does not own privileged
filesystem, SQLite, or operating-system operations. The preload script bridges
renderer features to the Electron main process, where handlers coordinate
services and persistent data.

## Where to make a change

| Layer                | Location                                                               | Responsibility                                                        |
| -------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Renderer caller      | `src/`                                                                 | Uses a narrow `window.*` API and handles its result.                  |
| Renderer API type    | `src/types/global.d.ts` and related shared types                       | Describes request, response, and event callback contracts.            |
| Preload bridge       | `electron/preload/index.ts`                                            | Exposes renderer methods with `contextBridge` and forwards IPC calls. |
| Main-process handler | `electron/handlers/`, `electron/workspaces/`, or another owning module | Validates and executes the operation using main-process services.     |

Prefer adding a named, typed API method to the relevant `window.*` namespace.
The preload currently also exposes a generic `window.ipcRenderer` compatibility
surface; do not add new renderer features that depend on arbitrary channel
access when a named API can express the operation.

## Request-response operations

Use `ipcRenderer.invoke` in preload and register the corresponding main-process
operation through `IPCMain.handle`:

```ts
// electron/preload/index.ts
contextBridge.exposeInMainWorld("example", {
  load: (id: string) => ipcRenderer.invoke("example:load", id),
} satisfies Window["example"]);

// electron/handlers/example-handler.ts
IPCMain.handle("example:load", async (_event, id: string) => {
  // Validate the input and call the owning service.
});
```

Add the matching `Window` API type before using the method in renderer code.
Keep the public API specific: pass only the data the operation needs and return
plain serializable values supported by Electron IPC.

The `IPCMain.handle` wrapper routes errors through the existing main-process
error handling and, when a workspace is active, checks that the sender's
workspace origin is allowed for that channel. Handlers still need to validate
their payloads, permissions, and operation-specific sender context. A
workspace-origin check is not a substitute for checking ownership or access
rights.

## Events and cleanup

For ongoing updates, expose a focused subscription method that registers one
listener and returns an unsubscribe function:

```ts
onChanged(callback: (value: ExampleValue) => void) {
  const listener = (_event: Electron.IpcRendererEvent, value: ExampleValue) =>
    callback(value);
  ipcRenderer.on("example:changed", listener);
  return () => ipcRenderer.removeListener("example:changed", listener);
}
```

Renderer effects should call the returned cleanup function when they unmount or
when the subscription is no longer needed. Avoid registering duplicate
listeners or leaving callbacks active across workspace/account changes. Use
request IDs when overlapping operations need distinct progress or completion
events.

## Boundary checklist

- Keep privileged work in the main process; the renderer calls the preload API.
- Add or update the public TypeScript contract and preload implementation with
  the handler.
- Validate untrusted IPC arguments in the main process, even when TypeScript
  types them in the renderer.
- Verify the sender window and workspace/account/document scope where the
  operation depends on them.
- Do not log passwords, tokens, private document contents, or full server
  responses.
- Propagate failures using the existing error/result contract; do not turn an
  IPC failure into a success-shaped default.
- For event subscriptions, return and use an explicit disposer.
- Add tests for invalid input, unauthorized or stale context, failures, and
  listener cleanup where applicable.

## Related code and tests

See `electron/utilities/ipc-main.ts` for the shared `IPCMain.handle` wrapper,
`electron/preload/index.ts` for renderer APIs, `src/types/global.d.ts` for
global contracts, and `electron/workspaces/handlers.ts` for workspace-scoped
handler checks. Feature handlers and their tests are the source of truth for
individual API behavior.
