import React, { useEffect, useState } from "react";
import { NavBar } from "../components/editor/navbar";
import { EditorContent, useEditor } from "@tiptap/react";

import "./../css/editor.css";
import "katex/dist/katex.css";
import { useParams } from "react-router-dom";
import { useParams as param } from "@/hooks/use-params";

import { EditorParams } from "../types/params/editor";
import { Manager } from "../editor/manager";

import { useZoom } from "../hooks/use-zoom";
import { Chapter } from "../editor/chapter/chapter";
import { useCurrentEditor } from "../hooks/use-editor";
import { EditorContentError } from "../exception/editor-content-error";
import { Document } from "@/editor/document";
import { ChapterNotFound } from "@/exception/chapter-not-found";
import { FrameManager } from "@/frame/manager";
import { ContextMenuPopup } from "@/components/context-menu";
import { getContextMenuItems } from "@/editor/context-menu.tsx";
import { openContextMenu } from "@/hooks/use-context-menu";
import { Eye, TrashIcon } from "lucide-react";
import { FrameNotOpened } from "@/exception/frame-not-opened";
import { Button } from "@/components/ui/button";
import { useExpandableSidebar } from "@/hooks/use-expandable-sidebar";
import { TableMenu } from "@/editor/components/table-menu";

export const Editor: React.FC = () => {
  const { zoom, showZoomUI, containerRef, zoomIn, zoomOut } = useZoom();

  const { id, version, chapter } = useParams<EditorParams>();

  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;

    const init = async () => {
      setLoaded(false);
      const doc = await new Document(id!, version).warm();
      const currentChapter = doc.chapters.find(
        (c) => c.getChapter() == (chapter ?? 1),
      );
      if (!currentChapter) {
        console.log("chapter not found", chapter);
        throw new ChapterNotFound(chapter);
      }
      Document.setCurrentChapter(currentChapter);

      if (!alive) return;
      setLoaded(true);
    };

    init();

    return () => {
      alive = false;
    };
  }, [id, version, chapter]);

  return (
    <div className="max-h-full w-screen overflow-scroll bg-[#f1f3f5] dark:bg-black ">
      <div
        className="w-full overflow-scroll h-full justify-between pt-4 scrollbar-none"
        id="main-scroll"
      >
        <NavBar />

        <div
          id="container"
          ref={containerRef}
          className="flex flex-col items-center py-3 space-y-2 scrollbar-none px-5"
        >
          <ContextMenuPopup />
          <ZoomUI
            zoom={zoom}
            visible={showZoomUI}
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
          />

          <div
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: "top center",
            }}
          >
            {loaded && Chapter.instance ? (
              <EditorComponent />
            ) : (
              <LoadingDocument />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const EditorComponent = () => {
  const { setEditor } = useCurrentEditor();
  const { params } = param();

  const { setContent, setOpen } = useExpandableSidebar();
  useEffect(() => {
    return FrameManager.onMessaged((m) => {
      if (m.type == "node:clicked") {
        Manager.scrollTo(m.data.uuid);
      }
    });
  }, []);

  const editor = useEditor({
    content: "",
    extensions: Chapter.instance!.extensions.get(),

    onCreate: async ({ editor }) => {
      let timer: any;

      const target = params.pop();
      if (target) {
        setTimeout(() => {
          Manager.scrollTo(target);
        }, 200);
      }
      editor.view.dom.addEventListener("input", () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          Manager.app.dispatch("chapter:commit", {
            chapter: Document.current!,
          });
        }, 800);
      });
      editor.view.dom.addEventListener("contextmenu", (e) => {
        e.preventDefault();

        const target = e.target as HTMLElement | null;
        if (!target?.id) return;

        openContextMenu(
          e.clientX,
          e.clientY,
          [
            {
              label: "Delete",
              danger: true,
              icon: <TrashIcon className="h-4 w-4" />,
              onClick: () => editor.commands.deleteSelection(),
            },
            {
              label: "See In Preview",
              icon: <Eye className="h-4 w-4" />,
              onClick: () => {
                const frame = document.querySelector("iframe");
                if (!frame) {
                  throw new FrameNotOpened({
                    message: "Frame Not Opened",
                    description: "Please Open Previewer First!",
                    action: (
                      <Button
                        onClick={() => {
                          setContent("previewer");
                          setOpen(true);
                        }}
                      >
                        Open
                      </Button>
                    ),
                  });
                }
                FrameManager.sendMessage(
                  "node:clicked",
                  { uuid: target.id, type: "node:clicked" },
                  frame,
                );
              },
            },
            ...getContextMenuItems(editor),
          ],
          target,
        );
      });

      setEditor(editor);
      await Manager.emit("create", {
        editor,
      });
    },

    onUpdate: async ({ editor }) => {
      await Manager.emit("update", {
        editor,
      });
    },

    onContentError: (props) => {
      console.log(props)
      throw new EditorContentError(props.editor);
    },

    enableContentCheck: true,
  });

  return (
    <div
      id="page"
      style={{
        //@ts-ignore
        "--start-counter": Chapter.instance!.getNumber(),
      }}
      className={`page ${Chapter.instance?.getHtmlClass()} bg-white dark:bg-neutral-900! rounded-md shadow-[0_8px_30px_rgba(0,0,0,0.06)]`}
    >
      <EditorContent
        spellCheck={window.config.get()?.editor?.spellCheck || false}
        editor={editor}
      />
      <TableMenu editor={editor} />
    </div>
  );
};

const ZoomUI = ({
  zoom,
  visible,
  onZoomIn,
  onZoomOut,
}: {
  zoom: number;
  visible: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
}) => {
  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-10 transition-all duration-300 ${
        visible
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-3 pointer-events-none"
      }`}
    >
      <div
        className="
          flex items-center gap-2
          bg-white/90 dark:bg-neutral-900/90
          backdrop-blur-xl
          border border-neutral-200 dark:border-neutral-800
          shadow-xl shadow-black/5 dark:shadow-black/30
          rounded-2xl
          px-3 py-2
          transition-colors duration-300
        "
      >
        <button
          onClick={onZoomOut}
          className="
            text-sm
            px-2.5 py-1
            rounded-lg
            text-neutral-700 dark:text-neutral-300
            hover:bg-neutral-100 dark:hover:bg-neutral-800
            transition-colors
          "
        >
          −
        </button>

        <div className="text-xs w-12 text-center text-neutral-600 dark:text-neutral-400">
          {Math.round(zoom * 100)}%
        </div>

        <button
          onClick={onZoomIn}
          className="
            text-sm
            px-2.5 py-1
            rounded-lg
            text-neutral-700 dark:text-neutral-300
            hover:bg-neutral-100 dark:hover:bg-neutral-800
            transition-colors
          "
        >
          +
        </button>
      </div>
    </div>
  );
};

const LoadingDocument = () => {
  return (
    <div
      className="
        page
        bg-white dark:bg-neutral-900!
        rounded-xl
        border border-neutral-200 dark:border-neutral-800
        shadow-[0_10px_40px_rgba(0,0,0,0.06)]
        dark:shadow-[0_10px_40px_rgba(0,0,0,0.35)]
        overflow-hidden
        transition-colors duration-300
      "
    >
      <div className="py-14">
        <div className="animate-pulse">
          <div className="h-8 w-64 rounded-xl bg-neutral-100 dark:bg-neutral-800 mb-10" />

          <div className="space-y-4">
            <div className="h-3 rounded-full bg-neutral-100 dark:bg-neutral-800 w-full" />
            <div className="h-3 rounded-full bg-neutral-100 dark:bg-neutral-800 w-[95%]" />
            <div className="h-3 rounded-full bg-neutral-100 dark:bg-neutral-800 w-[90%]" />
          </div>

          <div className="space-y-4 mt-10">
            <div className="h-3 rounded-full bg-neutral-100 dark:bg-neutral-800 w-full" />
            <div className="h-3 rounded-full bg-neutral-100 dark:bg-neutral-800 w-[92%]" />
            <div className="h-3 rounded-full bg-neutral-100 dark:bg-neutral-800 w-[85%]" />
            <div className="h-3 rounded-full bg-neutral-100 dark:bg-neutral-800 w-[88%]" />
          </div>

          <div className="space-y-4 mt-10">
            <div className="h-3 rounded-full bg-neutral-100 dark:bg-neutral-800 w-full" />
            <div className="h-3 rounded-full bg-neutral-100 dark:bg-neutral-800 w-[96%]" />
            <div className="h-3 rounded-full bg-neutral-100 dark:bg-neutral-800 w-[82%]" />
          </div>
        </div>

        <div className="mt-12 flex items-center gap-2 text-xs text-neutral-400 dark:text-neutral-500">
          <div className="w-2 h-2 rounded-full bg-neutral-300 dark:bg-neutral-700 animate-pulse" />
          Loading document...
        </div>
      </div>
    </div>
  );
};
