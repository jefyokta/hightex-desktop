import { useEffect, useState, type ReactNode } from "react";
import css from "@/css/document.css?url";
import tocCss from "@/css/toc.css?url";
import fontCss from "@/assets/fonts/style.css?url";
import { createElementFromUrl } from "@/utils/create-element-from-url";

export const PrintStyles = ({
  children,
  onError,
}: {
  children: ReactNode;
  onError?(error: unknown): void;
}) => {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    const elements: HTMLElement[] = [];
    document
      .querySelectorAll('style, link[rel="stylesheet"]')
      .forEach((element) => element.remove());
    void (async () => {
      for (const url of [fontCss, css, tocCss]) {
        // Fetch raw CSS in development, using the existing print utility.
        const element = await createElementFromUrl(
          `${url}${url.includes("?") ? "&" : "?"}direct`,
        );
        if (!active) return;
        if (!element) throw new Error("Print stylesheet unavailable");
        elements.push(element);
        document.head.append(element);
      }
      await document.fonts.ready;
      if (active) setReady(true);
    })().catch((error) => {
      if (active) {
        setError(true);
        onError?.(error);
      }
    });
    return () => {
      active = false;
      elements.forEach((element) => element.remove());
    };
  }, [onError]);
  if (error) return <p role="alert">Unable to load preview styles.</p>;
  return ready ? children : null;
};
