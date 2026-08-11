import { Engine } from "@/compiler/engine";
import { useEffect, useRef } from "react";
import { usePrintable } from "@/hooks/use-printable";
import { ApplicationError } from "@/exception/interfaces/application-error";
import { useParams } from "react-router-dom";
import { StaticPages } from "@/compiler/static-pages";

export const FullDocument = () => {
  const sourceRef = useRef<HTMLDivElement | null>(null);
  const renderRef = useRef<HTMLDivElement | null>(null);
  const parserRef = useRef<HTMLDivElement | null>(null);

  const { document, profile, ready } = usePrintable();
  const { waterMark = false } = useParams();
  useEffect(() => {
    if (
      !ready ||
      !document ||
      !profile ||
      !sourceRef.current ||
      !renderRef.current ||
      !parserRef.current ||
      !document.ready
    ) {
      return;
    }
    Engine.getInstance()
      .mount(parserRef.current)
      .withConfig({
        parser: {
          mode: "full",
          document,
        },
        paged: {
          renderTo: renderRef.current!,
          content: sourceRef.current,
        },
        profile,
        waterMark: Boolean(waterMark),
      })
      .interactable()
      .whenPagesCreated((e) => {
        window.dispatchEvent(new CustomEvent("document:rendered"));
        if (e.error) {
          throw e.error;
        }
      })
      .run()
      .then(async (engine) => {
        await engine.createPaged();
      })
      .catch((e) => {
        if ("ipcRenderer" in window) {
          window.ipcRenderer.send(
            `page:error:${document.id}`,
            ApplicationError.normilize(e),
          );
        }
      });
  }, [document, profile, ready]);

  if (!document) {
    return null;
  }

  const categoryVariant: CategoryVariant =
    document.category?.variant ?? "thesis";

  const FrontPages = StaticPages.create(categoryVariant);

  return (
    <>
      <div ref={sourceRef} style={{ display: "none" }}>
        <FrontPages />

        <div className="content" ref={parserRef}></div>
      </div>
      <div ref={renderRef}></div>
    </>
  );
};
