import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { FullDocument } from "@/components/printable";
import { PrintStyles } from "@/components/submission/print-styles";
import { PrintableProvider } from "@/hooks/use-printable";
import { HighTexDB } from "@/editor/storage/hightex-db";
import { readSnapshot, type SnapshotSource } from "@/review/snapshot-reader";
import { resolveDocumentProfile } from "@/utils/document-profile";
import { createSnapshotPreviewStore } from "@/review/snapshot-preview-store";

export const SubmissionPrint = () => {
  const { id } = useParams();
  const [ready, setReady] = useState(false);
  const request = new URLSearchParams(window.location.search).get("request");
  const pdf = new URLSearchParams(window.location.search).get("pdf") === "1";
  const target =
    window.location.origin === "null" ? "*" : window.location.origin;
  const onError = useCallback(
    (error: unknown) => {
      if (pdf && request) {
        window.snapshotPrint.error(
          request,
          error instanceof Error ? error.message : "preview_failed",
        );
        return;
      }
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
    [request, target, pdf],
  );

  useEffect(() => {
    if ((!pdf && window.parent === window) || !request || !id) return;
    let active = true;
    let received = false;
    let dispose: (() => void) | undefined;
    const initialize = (payload: {
      file: Uint8Array;
      source: SnapshotSource;
      categories: Category[];
    }) => {
      if (received) return;
      received = true;
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
        // This module runs in a separate iframe or PDF window JS realm.
        // Reuse the print components unchanged with this frame's memory store.
        HighTexDB.getInstance = () => store.db;
        if (!pdf)
          window.hightex = {
            categories: async () => [store.category],
          } as Window["hightex"];
        if (!pdf)
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
        if (pdf) {
          const rendered = () => {
            void (async () => {
              await document.fonts.ready;
              await Promise.all(
                Array.from(document.images).map((image) =>
                  image.decode().catch(() => {}),
                ),
              );
              if (!active) return;
              const profile = resolveDocumentProfile(snapshot.document);
              window.snapshotPrint.result(request, {
                documentId: snapshot.document.id,
                sha256: snapshot.sha256,
                title: snapshot.document.title,
                author: profile.name,
                keywords: snapshot.document.keywords.indonesian,
                incomplete: Boolean(profile.incomplete),
              });
            })().catch(onError);
          };
          document.addEventListener("page:rendered", rendered, { once: true });
          const disposeStore = dispose;
          dispose = () => {
            document.removeEventListener("page:rendered", rendered);
            disposeStore?.();
          };
        }
        setReady(true);
      })().catch((error) => {
        if (active) onError(error);
      });
    };
    const listener = (event: MessageEvent) => {
      if (
        pdf ||
        event.source !== window.parent ||
        event.origin !== window.location.origin ||
        event.data?.type !== "snapshot:preview:init" ||
        event.data.request !== request
      )
        return;
      initialize(event.data);
    };
    window.addEventListener("message", listener);
    if (pdf)
      void window.snapshotPrint.init(request).then(initialize).catch(onError);
    else
      window.parent.postMessage(
        { type: "snapshot:preview:ready", request },
        target,
      );
    return () => {
      active = false;
      window.removeEventListener("message", listener);
      dispose?.();
    };
  }, [id, request, target, onError, pdf]);

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
