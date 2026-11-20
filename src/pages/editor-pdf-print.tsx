import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { installPDFSnapshot } from "@/document-export/print/install-snapshot";
const EditorPDFDebugControls = lazy(() => import("@/document-export/debug/debug-controls").then(module => ({ default: module.EditorPDFDebugControls })));

export function EditorPDFPrint() {
  const root = useRef<HTMLDivElement>(null);
  const [snapshot, setSnapshot] = useState<EditorPDFSnapshot>();
  const debug =
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).get("debug") === "1";
  useEffect(() => {
    const request = new URLSearchParams(window.location.search).get("request");
    if (!request || !root.current) return;
    const task = new AbortController();
    let dispose: (() => void) | undefined;
    void (async () => {
      const snapshot = await window.editorPDFExperimental.init(request);
      task.signal.throwIfAborted();
      dispose = await installPDFSnapshot(root.current!, snapshot, task.signal);
      task.signal.throwIfAborted();
      if (debug) {
        // Inert retargets pointer hit-testing to an ancestor, hiding the actual
        // content from the DevTools picker. Only the inspection DOM is unlocked.
        root
          .current!.querySelectorAll<HTMLElement>("[inert]")
          .forEach((node) => {
            node.inert = false;
          });
      }
      setSnapshot(snapshot);
      window.editorPDFExperimental.ready(
        request,
        snapshot.fingerprint,
        snapshot.pages,
      );
    })().catch((error) => {
      if (!task.signal.aborted)
        window.editorPDFExperimental.error(
          request,
          error instanceof Error ? error.message : String(error),
        );
    });
    return () => {
      task.abort();
      dispose?.();
    };
  }, []);
  return (
    <>
      <div ref={root} data-editor-pdf-debug-surface={debug ? "" : undefined} />
      {debug && snapshot && <Suspense fallback={null}><EditorPDFDebugControls snapshot={snapshot} /></Suspense>}
    </>
  );
}
