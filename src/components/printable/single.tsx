import { HighTexDB } from "@/editor/storage/hightex-db";
import { useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import * as Paged from "pagedjs";

import BaseHandler from "@/compiler/handlers/basehandler";
import { Engine } from "@/compiler/engine";
import { Chapter } from "@/editor/chapter";
import { cn } from "@/lib/utils";
// import { FrameManager } from "@/frame/manager";
// import { BreakHandler } from "@/compiler/handlers/break-handler";

Paged.registerHandlers(BaseHandler);

export const Single = () => {
  const { chapterId } = useParams();

  const sourceRef = useRef<HTMLDivElement>(null);
  const pagedRef = useRef<HTMLDivElement>(null);
  const renderRef = useRef<HTMLDivElement>(null);

  const lastRenderedChapter = useRef<string | null>(null);

  const render = async (id: string) => {
    if (!sourceRef.current || !pagedRef.current || !renderRef.current) {
      return;
    }

    const rawChapter = await HighTexDB.getInstance().chapters.get(id);

    if (!rawChapter) return;

    const chapter = new Chapter(rawChapter.id);

    const engine = Engine.getInstance();
    engine.interactable();

    await engine
      .withConfig({
        paged: {
          content: pagedRef.current,
          renderTo: renderRef.current,
        },
        parser: {
          mode: "single",
          chapter,
        },
      })
      .mount(sourceRef.current)
      .whenPagesCreated((engine) => {
        const pagedRoot = engine.config.paged?.renderTo;

        if (!pagedRoot) return;

        pagedRoot.querySelectorAll("a").forEach((e) => {
          e.addEventListener("click", (ev) => ev.preventDefault());
        });
      })
      .run()
      .then(async (engine) => {
        console.log("memek")
        await engine.createPaged();
      });

    // await engine.createPaged();
  };

  useEffect(() => {
    if (!chapterId) return;

    if (lastRenderedChapter.current === chapterId) {
      return;
    }

    lastRenderedChapter.current = chapterId;

    render(chapterId);
  }, [chapterId]);

  return (
    <>
      <div
        ref={pagedRef}
        style={{
          overflow: "hidden",
          position: "absolute",
          pointerEvents: "none",
          display: "none",
        }}
      >
        <section ref={sourceRef} className={cn("content")} />

        {/* <div style={{ breakBefore: "always", pageBreakBefore: "always" }}>
          <section className="biblio new-page">
            <h1 id="bibliography" className="chapter">DAFTAR PUSTAKA</h1>
            <div id="cite-entries"></div>
          </section>
        </div> */}
      </div>

      <div
        id="single"
        //pagedjs will render here
        ref={renderRef}
        className="pagedjs-container"
      />
    </>
  );
};
