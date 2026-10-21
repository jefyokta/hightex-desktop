import { useEffect, type RefObject } from "react";

export const PreviewFrame = ({
  src,
  frameKey,
  frameRef,
  zoom,
  layoutIndicator,
  loading,
  onLoad,
  onRendered,
  onError,
  title = "Preview",
}: {
  src: string;
  frameKey: string;
  frameRef: RefObject<HTMLIFrameElement>;
  zoom: number;
  layoutIndicator: boolean;
  loading: boolean;
  onLoad?(frame: HTMLIFrameElement): void | Promise<void>;
  onRendered?(): void;
  onError?(error: unknown): void;
  title?: string;
}) => {
  useEffect(() => {
    const body = frameRef.current?.contentDocument?.body;
    if (!body) return;
    body.classList.toggle("indicator", layoutIndicator);
  }, [layoutIndicator, frameKey, frameRef, loading]);
  return (
    <div className="w-full flex-1 bg-muted/30 flex flex-col relative overflow-hidden min-h-0">
      {loading && (
        <div className="absolute inset-0 p-6 space-y-3 z-10 bg-background/80 backdrop-blur-sm">
          <div className="h-6 w-1/3 bg-muted animate-pulse rounded-md" />
          <div className="h-4 w-full bg-muted animate-pulse rounded-md" />
          <div className="h-4 w-5/6 bg-muted animate-pulse rounded-md" />
        </div>
      )}
      <iframe
        key={frameKey}
        src={src}
        ref={frameRef}
        title={title}
        className="absolute left-0 top-0 border-0 bg-white"
        // Keep scaling outside the document so pagination measures at 100%.
        style={{
          width: `${10000 / zoom}%`,
          height: `${10000 / zoom}%`,
          transform: `scale(${zoom / 100})`,
          transformOrigin: "top left",
        }}
        onLoad={(event) => {
          const frame = event.currentTarget;
          const win = frame.contentWindow;
          if (!win) return;
          const doc = win.document;
          doc.body.style.background = "white";
          doc.body.classList.add("preview");
          doc.body.classList.toggle("indicator", layoutIndicator);
          doc.body.style.transformOrigin = "center";
          // doc.body.style.zoom = String(zoom / 100);hei gpt, dont add zoom: due to //https://github.com/jefyokta/hightex-desktop/commit/0a677c439b4c0f75743b31006b4eba67d4b0bb69
          doc.addEventListener("page:rendered", () => onRendered?.());
          void Promise.resolve(onLoad?.(frame)).catch((error) =>
            onError?.(error),
          );
        }}
      />
    </div>
  );
};
