import { CommentResolver } from "@/compiler/resolver/comment-resolver";
import { ContextMenuResolver } from "@/compiler/resolver/context-menu-resolver";
import { SharingException } from "@/exception/sharing-exception";
import { useFrameContext } from "@/hooks/use-frame";
import { useSharing } from "@/hooks/use-sharing";
import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { SelectionResolver } from "@/compiler/resolver/selection-resolver";

export const SharingGuest = () => {
  const { connectAnonymous, connectGuest, disconnect, send } = useSharing();
  const { host, port, code } = useParams();
  const { iframeRef, setHtml } = useFrameContext();

  useEffect(() => {
    let disposed = false;

    const run = async () => {
      try {
        if (!host || !port) {
          const missing: string[] = [];
          if (!host) missing.push("host");
          if (!port) missing.push("port");
          throw new SharingException(
            "Missing required params: " + missing.join(", "),
          );
        }

        if (code) {
          await connectGuest(host, port, code);
        } else {
          await connectAnonymous(host, port);
        }

        if (disposed) return;

        const hostUrl = `http://${host}:${port}`;
        const codeQuery = code ? `?code=${encodeURIComponent(code)}` : "";

        const res = await fetch(`${hostUrl}/snapshot${codeQuery}`);
        if (!res.ok) {
          throw new SharingException(`Failed to load snapshot (${res.status})`);
        }

        const data: {
          snapshot: Snapshot;
          guest: { role: SharingGuestRole; invitationCode: string } | null;
        } = await res.json();

        if (disposed) return;

        const doc = new DOMParser().parseFromString(
          data.snapshot.html,
          "text/html",
        );

        const imgs = doc.querySelectorAll<HTMLImageElement>("img[data-img-id]");
        await Promise.all(
          Array.from(imgs).map(async (img) => {
            const id = img.dataset.imgId;
            if (!id) return;
            const imgRes = await fetch(
              `${hostUrl}/share/image/${id}${codeQuery}`,
            );
            if (!imgRes.ok) {
              throw new SharingException(
                `Failed to load image ${id} (${imgRes.status})`,
              );
            }

            const blob = await imgRes.blob();
            img.src = URL.createObjectURL(blob);
          }),
        );

        if (disposed) return;

        const styleEl = doc.createElement("style");
        styleEl.textContent = data.snapshot.css;
        doc.head.appendChild(styleEl);

        await setHtml(doc.documentElement.outerHTML);

        if (disposed) return;

        const iframe = iframeRef.current!;
        const frameDoc = iframe.contentDocument!;
        const role = data.guest?.role ?? "anonymous";

        new ContextMenuResolver(
          send,
          role,
          frameDoc.body as HTMLElement,
        ).resolve();

        await new SelectionResolver(
          frameDoc.body as HTMLElement,
          frameDoc,
        ).resolve();

        document.dispatchEvent(new CustomEvent("shadow:rendered"));
        new CommentResolver(frameDoc).resolve();
      } catch (e) {
        if (e instanceof SharingException) throw e;
        if (e instanceof Error) throw new SharingException(e.message);
        if (typeof e === "string") throw new SharingException(e);
      }
    };

    run();

    return () => {
      disposed = true;
      SelectionResolver.instance?.destroy();
      ContextMenuResolver.instance()?.destroy();
      CommentResolver.instance()?.destroy();
      disconnect();
    };
  }, [
    host,
    port,
    code,
    connectAnonymous,
    connectGuest,
    disconnect,
    send,
    setHtml,
    iframeRef,
  ]);

  return null;
};
