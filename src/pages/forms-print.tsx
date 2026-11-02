import { useEffect, useMemo, useRef, useState } from "react";
import { FormDocument } from "@/components/forms/form-document";
import {
  buildFormFiles,
  validatePrintInput,
  type FormPrintInput,
} from "@/forms/model";
import fontCss from "@/assets/fonts/style.css?url";

import css from "@/forms/print.css?inline";

export function FormsPrint() {
  const root = useRef<HTMLDivElement>(null);
  const [payload, setPayload] = useState<{
    input: FormPrintInput;
    index: number;
  }>();
  const [error, setError] = useState("");
  const params = new URLSearchParams(window.location.search);
  const request = params.get("request") ?? "";
  const pdf = params.get("pdf") === "1";
  const files = useMemo(
    () => (payload ? buildFormFiles(payload.input) : []),
    [payload],
  );
  const file = payload ? files[payload.index] : undefined;
  useEffect(() => {
    if (!request) return;
    let active = true;
    document
      .querySelectorAll('style,link[rel="stylesheet"]')
      .forEach((element) => element.remove());
    const style = document.createElement("style");
    style.textContent = css;
    document.head.append(style);
    const font = document.createElement("link");
    font.rel = "stylesheet";
    font.href = fontCss;
    document.head.append(font);
    const accept = (input: FormPrintInput, index: number) => {
      if (!validatePrintInput(input) || !buildFormFiles(input)[index]) {
        setError("Data formulir tidak valid.");
        return;
      }
      setPayload({ input, index });
    };
    const listener = (event: MessageEvent) => {
      if (
        pdf ||
        event.source !== window.parent ||
        event.origin !== window.location.origin ||
        event.data?.type !== "forms:init" ||
        event.data.request !== request
      )
        return;
      accept(event.data.input, event.data.index ?? 0);
    };
    window.addEventListener("message", listener);
    if (pdf) {
      void window.formPrint
        .init(request)
        .then((input) => {
          if (active)
            accept(
              input,
              Number(
                new URLSearchParams(window.location.search).get("file") ?? 0,
              ),
            );
        })
        .catch((reason) => {
          if (active) {
            const message = String(reason);
            setError(message);
            window.formPrint.error(request, message);
          }
        });
    } else
      window.parent.postMessage(
        { type: "forms:ready", request },
        window.location.origin,
      );
    return () => {
      active = false;
      window.removeEventListener("message", listener);
      font.remove();
      style.remove();
    };
  }, [request, pdf]);
  useEffect(() => {
    if (!payload || !file || !root.current) return;
    let active = true;
    const pageStyle = document.createElement("style");
    const paper = root.current.querySelector<HTMLElement>(".forms-paper")!;
    pageStyle.textContent = `@page{size:${paper.style.width} ${paper.style.height};margin:0}`;
    document.head.append(pageStyle);
    const resize = () => {
      const pages = root.current?.querySelector<HTMLElement>(".forms-pages");
      if (!pdf && root.current && pages)
        pages.style.setProperty(
          "zoom",
          String(
            Math.min(
              1,
              (root.current.clientWidth - 24) /
                ((parseFloat(paper.style.width) * 96) / 72),
            ),
          ),
        );
    };
    window.addEventListener("resize", resize);
    resize();
    void (async () => {
      // Wait for the stylesheet before loading faces or measuring text.
      const link = document.querySelector<HTMLLinkElement>(
        'link[rel="stylesheet"]',
      );
      if (link && !link.sheet)
        await new Promise<void>((resolve, reject) => {
          link.addEventListener("load", () => resolve(), { once: true });
          link.addEventListener(
            "error",
            () => reject(Error("Font formulir tidak dapat dimuat.")),
            { once: true },
          );
        });
      await Promise.all([
        document.fonts.load('12pt "Times New Roman"'),
        document.fonts.load('bold 12pt "Times New Roman"'),
        document.fonts.load('italic 12pt "Times New Roman"'),
      ]);
      await Promise.all(
        Array.from(root.current!.querySelectorAll("img")).map((image) =>
          image.decode(),
        ),
      );
      if (!active) return;
      for (const sheet of root.current!.querySelectorAll<HTMLElement>(
        ".forms-paper",
      )) {
        if (sheet.scrollHeight > sheet.clientHeight + 2) {
          throw Error(
            `${file.label}: isi formulir melebihi ukuran halaman. Periksa panjang judul atau nama dosen.`,
          );
        }
      }
      document.title = file.label;
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      if (!active) return;
      if (pdf) window.formPrint.ready(request, payload.index);
      else
        window.parent.postMessage(
          {
            type: "forms:rendered",
            request,
            index: payload.index,
            pages: file.pages,
          },
          window.location.origin,
        );
    })().catch((reason) => {
      if (!active) return;
      const message = reason instanceof Error ? reason.message : String(reason);
      setError(message);
      if (pdf) window.formPrint.error(request, message);
      else
        window.parent.postMessage(
          { type: "forms:error", request, message },
          window.location.origin,
        );
    });
    return () => {
      active = false;
      pageStyle.remove();
      window.removeEventListener("resize", resize);
    };
  }, [payload, file, request, pdf]);
  return (
    <>
      {error && <p role="alert">{error}</p>}
      <div id="forms-render" ref={root}>
        {payload && file && (
          <FormDocument key={file.filename} input={payload.input} file={file} />
        )}
      </div>
    </>
  );
}
