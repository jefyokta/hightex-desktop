import { useLayoutEffect, useState, type CSSProperties } from "react";

/** Keep large dialogs below the editor titlebar, including after resizing or zooming. */
export function useDialogViewport(): CSSProperties {
  const [inset, setInset] = useState(0);
  useLayoutEffect(() => {
    const titlebar = document.querySelector("[data-editor-titlebar]");
    const update = () =>
      setInset(Math.max(0, titlebar?.getBoundingClientRect().bottom ?? 0));
    const observer = new ResizeObserver(update);
    if (titlebar) observer.observe(titlebar);
    window.addEventListener("resize", update);
    update();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);
  return {
    top: `calc(${inset}px + (100dvh - ${inset}px) / 2)`,
    maxHeight: `calc(100dvh - ${inset}px - 24px)`,
  };
}
