/** Resolve a preload namespace in this window or its accessible immediate parent.
 * This is a stateless resolver, so non-React services can use it too.
 * Local snapshot/print adapters must take precedence over a host workspace API.
 */
export function useIPC(namespace?: keyof Window): Window {
  const local = window;
  if (namespace && local[namespace]) return local;
  try {
    const parent = local.parent;
    if (parent && parent !== local) {
      // Reading a same-origin-only property prevents returning an inaccessible proxy.
      void parent.document;
      if (!namespace || parent[namespace]) return parent;
    }
  } catch {
    // A cross-origin parent cannot supply this renderer's preload APIs.
  }
  return local;
}

