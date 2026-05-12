import { useEffect, useState } from "react";

type ScrollPosition = {
  x: number;
  y: number;
};

type UseScrollOptions = {
  throttleMs?: number;
  target?: Window | HTMLElement | null;
};

export function useScroll(options: UseScrollOptions = {}) {
  const { throttleMs = 0, target } = options;

  const [scroll, setScroll] = useState<ScrollPosition>({
    x: 0,
    y: 0,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const el: any = target || window;

    let ticking = false;
    let lastTime = 0;

    const getPosition = (): ScrollPosition => {
      if (el === window) {
        return {
          x: window.scrollX,
          y: window.scrollY,
        };
      }

      return {
        x: el.scrollLeft,
        y: el.scrollTop,
      };
    };

    const update = () => {
      const now = Date.now();

      if (throttleMs && now - lastTime < throttleMs) {
        ticking = false;
        return;
      }

      lastTime = now;
      setScroll(getPosition());
      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };

    el.addEventListener("scroll", onScroll, { passive: true });

    setScroll(getPosition());

    return () => {
      el.removeEventListener("scroll", onScroll);
    };
  }, [target, throttleMs]);

  return scroll;
}
