import type { Document } from "@/editor/document";
import { createSnapshot } from "./snapshot";
import type { ScanEvent } from "./plugins";

export function startScan(doc: Document, onEvent: (event: ScanEvent) => void) {
  let worker: Worker | null = null;
  let cancelled = false;

  const fail = (message: string) => {
    onEvent({ type: "error", id: "*", message });
    onEvent({ type: "done" });
  };

  createSnapshot(doc)
    .then((snapshot) => {
      if (cancelled) return;

      worker = new Worker(new URL("./scanner.worker.ts", import.meta.url), {
        type: "module",
      });

      worker.onmessage = ({ data }: MessageEvent<ScanEvent>) => {
        if (cancelled) return;
        onEvent(data);
        if (data.type === "done") worker?.terminate();
      };

      worker.onerror = (e) => {
        if (cancelled) return;
        fail(e.message || "Worker error");
        worker?.terminate();
      };

      worker.postMessage(snapshot);
    })
    .catch((e) => {
      if (!cancelled) fail(String(e));
    });

  return () => {
    cancelled = true;
    worker?.terminate();
  };
}