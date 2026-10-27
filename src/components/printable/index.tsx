import { Engine } from "@/compiler/engine";
import { useEffect, useRef } from "react";
import { usePrintable } from "@/hooks/use-printable";
import { reportPrintError } from "@/utils/print-request";
import { useParams } from "react-router-dom";
import { StaticPages } from "@/compiler/static-pages";
import { CVPageBuilder } from "@/compiler/builder/cv-builder";
import { t } from "@/utils/lang";

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
    let active = true;
    const engine = Engine.getInstance()
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
      .whenPagesCreated(async (e) => {
        await CVPageBuilder.create(e).then((_) => {
          window.dispatchEvent(new CustomEvent("document:rendered"));
          if (e.error) {
            throw e.error;
          }
        });
      });
    engine
      .run()
      .then(async () => {
        if (active) await engine.createPaged();
      })
      .catch((e) => {
        if (active) reportPrintError(document.id, e);
      });
    return () => {
      active = false;
      engine.destroy();
    };
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
        {profile?.incomplete && <p>{t("document_profile.print_missing")}</p>}
        <FrontPages />

        <div className="content" ref={parserRef}></div>
      </div>
      <div ref={renderRef}></div>
    </>
  );
};
