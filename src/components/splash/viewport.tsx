import { useLayoutEffect, useRef, type PropsWithChildren } from "react";

/** Fit the complete splash composition, including after resizing or browser zoom. */
export function SplashViewport({ children }: PropsWithChildren) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const viewport = viewportRef.current!;
    const content = contentRef.current!;
    let available: DOMRectReadOnly | undefined;
    let required: DOMRectReadOnly | undefined;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === viewport) available = entry.contentRect;
        else required = entry.contentRect;
      }
      if (!available || !required) return;
      const scale = Math.min(1, available.width / required.width, available.height / required.height);
      viewport.style.setProperty("--splash-fit", String(scale));
    });
    observer.observe(viewport);
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={viewportRef} className="splash-screen splash-viewport bg-background text-foreground">
      <div className="drag-bar absolute inset-x-0 top-0 z-10 h-7" aria-hidden="true" />
      <div ref={contentRef} className="splash-content">{children}</div>
    </div>
  );
}
