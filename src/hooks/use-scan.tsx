import { useCallback, useEffect, useRef, useState } from "react";
import { Document } from "@/editor/document";
import { createSnapshot } from "@/scanner/snapshot";
import type { ScanEvent, ScanResults } from "@/scanner/plugins";

export type ScanStatus = "idle" | "scanning" | "done" | "cancelled";
export type ScanError = { id: string; message: string };

export function useScan() {
  const [status, setStatus] = useState<ScanStatus>("idle");
  const [current, setCurrent] = useState<string | null>(null);
  const [completed, setCompleted] = useState(0);
  const [results, setResults] = useState<Partial<ScanResults>>({});
  const [errors, setErrors] = useState<ScanError[]>([]);

  const worker = useRef<Worker | null>(null);
  const runId = useRef(0);

  const stop = useCallback(() => {
    runId.current++;
    worker.current?.terminate();
    worker.current = null;
  }, []);

  const handle = useCallback((event: ScanEvent) => {
    switch (event.type) {
      case "progress":
        setCurrent(event.label);
        break;
      case "result":
        setResults((prev) => ({ ...prev, [event.id]: event.data }));
        setCompleted((n) => n + 1);
        break;
      case "error":
        setErrors((prev) => [
          ...prev,
          { id: event.id, message: event.message },
        ]);
        if (event.id !== "*") setCompleted((n) => n + 1);
        break;
      case "done":
        setCurrent(null);
        setStatus("done");
        break;
    }
  }, []);

  const run = useCallback(async () => {
    stop();
    const id = runId.current;

    setResults({});
    setErrors([]);
    setCompleted(0);
    setCurrent(null);

    const doc = Document.instance;
    if (!doc) {
      setErrors([{ id: "*", message: "Dokumen belum siap" }]);
      setStatus("done");
      return;
    }

    setStatus("scanning");

    try {
      const snapshot = await createSnapshot(doc);
      if (id !== runId.current) return;

      const w = new Worker(
        new URL("@/scanner/scanner.worker.ts", import.meta.url),
        {
          type: "module",
        },
      );
      worker.current = w;

      w.onmessage = ({ data }: MessageEvent<ScanEvent>) => {
        if (id !== runId.current) return;
        handle(data);
        if (data.type === "done") w.terminate();
      };
      w.onerror = (e) => {
        if (id !== runId.current) return;
        handle({
          type: "error",
          id: "*",
          message: e.message || "Worker error",
        });
        handle({ type: "done" });
        w.terminate();
      };

      w.postMessage(snapshot);
    } catch (e) {
      if (id !== runId.current) return;
      handle({ type: "error", id: "*", message: String(e) });
      handle({ type: "done" });
    }
  }, [stop, handle]);

  const cancel = useCallback(() => {
    stop();
    setCurrent(null);
    setStatus("cancelled");
  }, [stop]);

  useEffect(() => stop, [stop]);
  return { run, cancel, status, current, completed, results, errors };
}
