import { useEffect, useRef, useState } from "react";

export const useZoom = () => {
  const [zoom, setZoom] = useState(1);
  const [showZoomUI, setShowZoomUI] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimeout = useRef<any>(null);

  const clamp = (z: number) => {
    return Math.min(2, Math.max(0.5, z));
  };

  const triggerZoomUI = () => {
    setShowZoomUI(true);

    if (hideTimeout.current) {
      clearTimeout(hideTimeout.current);
    }

    hideTimeout.current = setTimeout(() => {
      setShowZoomUI(false);
    }, 1500);
  };

  const zoomIn = () => {
    setZoom((z) => clamp(z + 0.1));
    triggerZoomUI();
  };

  const zoomOut = () => {
    setZoom((z) => clamp(z - 0.1));
    triggerZoomUI();
  };

  const resetZoom = () => {
    setZoom(1);
    triggerZoomUI();
  };

  useEffect(() => {
    const el = containerRef.current;

    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;

      e.preventDefault();

      setZoom((z) => {
        return clamp(z - e.deltaY * 0.001);
      });

      triggerZoomUI();
    };

    el.addEventListener("wheel", handleWheel, {
      passive: false,
    });

    return () => {
      el.removeEventListener("wheel", handleWheel);
    };
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;

      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        zoomIn();
      }

      if (e.key === "-") {
        e.preventDefault();
        zoomOut();
      }

      if (e.key === "0") {
        e.preventDefault();
        resetZoom();
      }
    };

    window.addEventListener("keydown", handleKey);

    return () => {
      window.removeEventListener("keydown", handleKey);
    };
  }, []);

  return {
    zoom,
    showZoomUI,
    containerRef,

    zoomIn,
    zoomOut,
    resetZoom,
  };
};
