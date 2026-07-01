import { Engine } from "@/compiler/engine";
import {
  AbstractEnglish,
  AbstractIndonesian,
} from "@/compiler/sheets/abstracts";
import { Constent } from "@/compiler/sheets/consent";
import { Cover } from "@/compiler/sheets/cover";
import { Foreword } from "@/compiler/sheets/foreword";
import { IPR } from "@/compiler/sheets/ipr";
import { Presentation } from "@/compiler/sheets/presentation";
import { Statement } from "@/compiler/sheets/statement";
import { Validity } from "@/compiler/sheets/validity";
import { useEffect, useRef } from "react";
import { usePrintable } from "@/hooks/use-printable";

export const FullDocument = () => {
  const sourceRef = useRef<HTMLDivElement | null>(null);
  const renderRef = useRef<HTMLDivElement | null>(null);
  const parserRef = useRef<HTMLDivElement | null>(null);

  const { document, profile, ready } = usePrintable();

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
      })
      .interactable()
      .whenPagesCreated(() => {
        window.dispatchEvent(new CustomEvent("document:rendered"));
      })
      .run()
      .then(async (engine) => {
        await engine.createPaged();
      });
  }, [document, profile, ready]);

  if (!document) {
    return null;
  }

  return (
    <>
      <div ref={sourceRef} style={{ display: "none" }}>
        <Cover />
        {!(document.category?.min)

          && <>
            <Constent />

            <Validity />

            <IPR />

            <Statement />

            <Presentation />

            <Foreword />

            <AbstractIndonesian />

            <AbstractEnglish />
          </>
        }

        <div className="content" ref={parserRef}></div>
      </div>
      <div ref={renderRef}></div>
    </>
  );
};
