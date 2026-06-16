import { ContextMenuResolver } from "@/compiler/resolver/context-menu-resolver";
import { SelectionResolver } from "@/compiler/resolver/selection-resolver";
import { SharingException } from "@/exception/sharing-exception";
import { useFrameContext } from "@/hooks/use-frame";
import { useSharing } from "@/hooks/use-sharing";
import { useEffect } from "react";

export const SharingHost = () => {
  const { connectHost, send } = useSharing();
  const { iframeRef, setHtml } = useFrameContext();

  useEffect(() => {
    let disposed = false;

    (async () => {
      try {
        const info = await window.sharing.info();
        if (disposed) return;

        if (!info) {
          throw new SharingException("You are not sharing any document");
        }

        await connectHost(info.port, info.hostToken);
        if (disposed) return;

        const snapshot = await window.sharing.getSnapshot();
        if (disposed) return;

        const doc = new DOMParser().parseFromString(snapshot.html, "text/html");

        const imgs = doc.querySelectorAll<HTMLImageElement>("img[data-img-id]");
        await Promise.all(
          Array.from(imgs).map(async (img) => {
            const id = img.dataset.imgId;
            if (!id) return;
            const res = await fetch(
              `http://127.0.0.1:${info.port}/share/image/${id}?token=${encodeURIComponent(info.hostToken)}`,
            );
            const blob = await res.blob();
            img.src = URL.createObjectURL(blob);
          }),
        );

        if (disposed) return;

        const styleEl = doc.createElement("style");
        styleEl.textContent = snapshot.css;
        doc.head.appendChild(styleEl);

        await setHtml(doc.documentElement.outerHTML);

        if (disposed) return;

        const iframe = iframeRef.current!;

        new ContextMenuResolver(
          send,
          undefined,
          iframe.contentDocument!.body as any,
        ).resolve();

        await new SelectionResolver(
          iframe.contentDocument!.body as any,
          iframe.contentDocument!,
        ).resolve();

        document.dispatchEvent(new CustomEvent("shadow:rendered"));
      } catch (e) {
        if (e instanceof SharingException) throw e;
        if (e instanceof Error) throw new SharingException(e.message);
        if (typeof e === "string") throw new SharingException(e);
      }
    })();

    return () => {
      disposed = true;
    };
  }, [connectHost, send, setHtml, iframeRef]);

  return null;
};
