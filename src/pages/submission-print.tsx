import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { FullDocument } from "@/components/printable";
import { PrintStyles } from "@/components/submission/print-styles";
import { PrintableProvider } from "@/hooks/use-printable";
import { HighTexDB } from "@/editor/storage/hightex-db";
import { readSnapshot, type SnapshotSource } from "@/review/snapshot-reader";
import { createSnapshotPreviewStore } from "@/review/snapshot-preview-store";

export const SubmissionPrint = () => {
  const { id } = useParams();
  const [ready, setReady] = useState(false);
  const request = new URLSearchParams(window.location.search).get("request");
  const target =
    window.location.origin === "null" ? "*" : window.location.origin;
  const onError = useCallback(
    (error: unknown) => {
      window.parent.postMessage(
        {
          type: "snapshot:preview:error",
          request,
          code:
            error instanceof Error &&
            error.message === "snapshot_category_missing"
              ? "snapshot_category_missing"
              : "preview_failed",
        },
        target,
      );
    },
    [request, target],
  );

  useEffect(() => {
    if (window.parent === window || !request || !id) return;
    let active = true;
    let received = false;
    let dispose: (() => void) | undefined;
    const listener = (event: MessageEvent) => {
      if (
        event.source !== window.parent ||
        event.origin !== window.location.origin ||
        event.data?.type !== "snapshot:preview:init" ||
        event.data.request !== request ||
        received
      )
        return;
      received = true;
      const payload = event.data as {
        file: Uint8Array;
        source: SnapshotSource;
        categories: Category[];
      };
      void (async () => {
        const snapshot = await readSnapshot(payload.file, payload.source);
        if (!active) return;
        if (snapshot.document.id !== id)
          throw new Error("Snapshot document mismatch");
        const store = await createSnapshotPreviewStore(
          snapshot,
          payload.categories,
        );
        if (!active) {
          await store.db.delete();
          return;
        }
        // This module runs only in the submission iframe's separate JS realm.
        // Reuse the print components unchanged with this frame's memory store.
        HighTexDB.getInstance = () => store.db;
        window.hightex = {
          categories: async () => [store.category],
        } as Window["hightex"];
        window.ipcRenderer = {
          send: (channel: string, error: unknown) => {
            if (channel.startsWith("page:error:")) onError(error);
          },
        } as Window["ipcRenderer"];
        dispose = () => {
          // Keep the frame bound to memory even if pending print tasks finish
          // during teardown; they must never fall back to the real draft store.
          void store.db.delete();
        };
        setReady(true);
      })().catch((error) => {
        if (active) onError(error);
      });
    };
    window.addEventListener("message", listener);
    window.parent.postMessage(
      { type: "snapshot:preview:ready", request },
      target,
    );
    return () => {
      active = false;
      window.removeEventListener("message", listener);
      dispose?.();
    };
  }, [id, request, target, onError]);

  return (
    <PrintStyles onError={onError}>
      {ready && (
        <PrintableProvider>
          <FullDocument />
        </PrintableProvider>
      )}
    </PrintStyles>
  );
};
