# IPC APIs in Iframes

HighTex preview routes can run inside an iframe without an Electron preload.
Never assume that a `window.*` API exists just because TypeScript accepts the
call or the application builds successfully. Verify which window executes the
code and how that window receives its dependencies.

## Why the build passes and the preview fails

The declarations in `src/types/global.d.ts` describe APIs exposed by
`electron/preload/index.ts`. For example, `Window` declares a `profile` API, so
this code type-checks:

```ts
const profile = await window.profile.get();
```

Those declarations do not create runtime properties. Inside a preview iframe,
`window.profile` may be `undefined`, producing an error such as
`Cannot read properties of undefined (reading 'get')`.

TypeScript checks the declared contract. The build compiles and bundles the
code; neither check opens every route in its actual frame context. A type
assertion such as `as Window`, a non-null assertion, or an import of the API's
types cannot install the preload bridge.

The preload uses `contextBridge.exposeInMainWorld` to expose named APIs to its
renderer context. A child document has its own `window`; it does not inherit
JavaScript properties from its parent. Same-origin access permits explicit
access to the parent, but does not copy its APIs into the child.

## Identify the execution context

| Context                                                           | API availability                                                                                                            |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Application or editor `BrowserWindow` with the configured preload | Uses its own exposed APIs; individual calls can still fail.                                                                 |
| Editor preview route loaded through an iframe's `src`             | Has a separate window. Only explicitly supplied APIs or frame-aware helpers are available.                                  |
| Form or submission preview iframe                                 | Receives initialization data through its preview message protocol.                                                          |
| Dedicated PDF `BrowserWindow`                                     | Receives the configured preload and uses its PDF request protocol. This differs from an iframe showing the same route.      |
| React portal into an iframe document                              | React code still executes in the parent JavaScript context. The DOM destination does not change the code's global `window`. |

For portal code, `element.ownerDocument.defaultView` refers to the window that
owns the element. That may differ from the global `window` used by the module.
Check the execution context rather than inferring it from where the UI appears.

## Use the existing frame contract

### Workspace author profiles

For the current workspace author in working document previews, use the shared
helper rather than calling `window.profile` directly:

```ts
import { getWorkspaceAuthorProfile } from "@/utils/document-profile";

const profile = await getWorkspaceAuthorProfile();
```

The helper prefers the current window's profile API, then checks the immediate
same-origin parent. It reports a missing API when neither is available, caches
concurrent reads, invalidates on profile/session changes, and releases parent
subscriptions when the frame unloads. Reuse this behavior instead of adding
another parent lookup or an unrelated default identity.

Submitted snapshots must keep their recorded author profile. Do not use the
live workspace helper to replace snapshot data. See
`src/pages/submission-print.tsx` for the snapshot preview path.

### Editor document previews

`src/components/editor/expandable-items/preview.tsx` explicitly forwards
`hightex` into the preview window during `onLoad`. It also sets preview data
such as `current` and `cites`. Forwarding `hightex` does not supply `profile`,
`config`, `file`, `session`, or the rest of the preload namespaces.

`src/hooks/use-printable.tsx` resolves the printable `hightex` API from the
current window or parent, with a bounded wait if it is not yet available.
This is specific to that printable flow, not a universal API resolver.

Do not depend on an `onLoad` assignment being ready during the child's module
evaluation or initial effects: child scripts can execute before the parent's
iframe load handler. Wait for the established initialization contract before
starting dependent work. Reinitialize after navigation or reload and cancel
pending work when the frame is replaced.

### Form and submission previews

Prefer letting the parent perform IPC and sending only the resulting data to
the frame. Existing examples are:

- `src/pages/forms.tsx` and `src/pages/forms-print.tsx`: the frame announces
  `forms:ready`; the parent sends `forms:init` with the form input.
- `src/components/submission/snapshot-viewer.tsx` and
  `src/pages/submission-print.tsx`: the frame announces
  `snapshot:preview:ready`; the parent fetches categories through its API and
  sends `snapshot:preview:init` with the snapshot data.

The submission frame supplies small local adapters for shared print code.
Those adapters do not provide the full Electron API despite their `Window`
type assertions. Do not assume other methods exist on them.

For a new message flow, verify the expected `event.source`, origin, message
type, request ID, and payload before accepting data. Use an explicit target
origin where available. Some existing snapshot code handles an opaque origin
with `"*"`; do not copy that fallback into unrelated flows. Keep listeners
scoped to the request and remove them during cleanup.

## Handle unavailable APIs deliberately

When adding shared renderer code, pass the required data or a narrow API
dependency from the owning window. Keep IPC calls out of module-level
initialization in modules imported by frame routes.

For a required capability, check it at the runtime boundary and surface a clear
error through the feature's existing error path. For example, a caller that
specifically requires a local profile bridge can validate that requirement:

```ts
const api = (window as Partial<Pick<Window, "profile">>).profile;
if (typeof api?.get !== "function") {
  throw new Error("Profile API is not available in this window.");
}
const profile = await api.get();
```

Use `getWorkspaceAuthorProfile()` for working previews that support parent
access; the check above is not a replacement for that helper. A successful
capability check also does not guarantee that the IPC request will succeed.

Optional chaining is appropriate only when skipping the operation is valid.
Changing a required read to `window.profile?.get()` can hide the original
exception while leaving a preview stuck loading or using incomplete data.
Likewise, do not catch a failed IPC call and silently substitute another
workspace's identity or mark an export as successful.

Keep context isolation and the existing preload configuration. Do not enable
`nodeIntegrationInSubFrames`, disable isolation, import `ipcRenderer` into frame
code, or copy every preload namespace into a frame to work around a missing
capability. Resolve the specific dependency through the frame's contract.
Only use direct parent access for trusted same-origin application frames;
cross-origin access can throw and requires an explicit message protocol.

Calls made through a parent's exposed API still use that API's owning IPC
context. Keep validation in `electron/utilities/ipc-main.ts` and the owning
handler, including workspace, document, request, and sender-window checks.
Providing an API to a child does not grant access to another workspace.

## Verify the iframe path at runtime

For changes to code shared by a window and iframe:

1. Exercise the actual iframe route, including both single-chapter and
   full-document previews when applicable. Testing the route only as a
   top-level window misses this failure mode.
2. Leave APIs absent in the iframe fixture unless the real parent supplies
   them. A test that installs every `window.*` API in every frame can hide the
   bug. Capture runtime errors and unhandled promise rejections.
3. Verify initial loading, delayed initialization, an unavailable API, and a
   rejected IPC call. Failures should reach the existing error UI or print
   error path rather than leave an indefinite loading state.
4. Check frame reload/replacement, profile or session changes, and subscription
   cleanup so old callbacks cannot update a new preview.
5. When the route also supports PDF export, verify that separate window path
   and preserve snapshot identity where applicable.

Useful existing coverage:

```sh
bun test tests/workspace-author-profile.test.ts
env -u ELECTRON_RUN_AS_NODE ./node_modules/.bin/electron tests/integration/editor-preview-profile.cjs
```

The integration fixture exercises real single-chapter and full-document print
routes with the profile API present only on the parent. It does not establish
coverage for every other preload namespace. Follow the setup guidance in
[Testing and verification](./testing.md) for other Electron fixtures.

In DevTools, select the failing iframe's execution context and inspect
`window === window.parent`, `typeof window.profile`, and
`typeof window.hightex`. Inspect parent properties only for a same-origin
frame. Checking the top-level console alone can show an API that the failing
frame does not have.

## Related documentation

- [Electron renderer and IPC boundary](./electron-ipc.md)
- [Document rendering pipeline](./document-rendering.md)
- [Electron contextBridge reference](https://www.electronjs.org/docs/latest/api/context-bridge)
- [Electron WebPreferences reference](https://www.electronjs.org/docs/latest/api/structures/web-preferences)
