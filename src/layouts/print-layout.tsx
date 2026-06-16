import { Outlet } from "react-router-dom";
import { useEffect } from "react";
import css from "@/css/document.css?url";
import tocCss from "@/css/toc.css?url";
import fontCss from "@/assets/fonts/style.css?url";
import katexCSS from "katex/dist/katex.css?url";
import codeCss from "highlight.js/styles/github-dark.css?url";
import { PrintableProvider } from "@/hooks/use-printable";
import { createElementFromUrl } from "@/utils/create-element-from-url";

export const PrintLayout = () => {
  useEffect(() => {
    let els: HTMLElement[] = [];

    let mounted = true;

    const cleaning = () => {
      document.querySelectorAll("style").forEach((el) => el.remove());
      document
        .querySelectorAll('link[rel="stylesheet"]')
        .forEach((el) => el.remove());
    };
    const cleanup = () => {
      mounted = false;
      for (const el of els) {
        el.remove();
      }
    };
    (async () => {
      cleaning();
      if (!mounted) return;
      for (const url of [fontCss, katexCSS, css, tocCss, codeCss]) {
        const el = await createElementFromUrl(url);
        if (el) {
          els.push(el);
        }
      }

      console.log(els.map((e) => e.nodeName));

      document.head.append(...els);
    })();

    return () => {
      cleanup();
    };
  }, []);

  return (
    <PrintableProvider>
      <Outlet />
    </PrintableProvider>
  );
};
