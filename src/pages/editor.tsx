import React, { useCallback, useEffect, useState } from "react";
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
import { FindReplaceBar } from "@/components/editor/find-replace-bar";
import { getContextMenuItems } from "@/editor/context-menu";
import { openContextMenu } from "@/hooks/use-context-menu";
import { Eye, TrashIcon } from "lucide-react";
import { FrameNotOpened } from "@/exception/frame-not-opened";
import { Button } from "@/components/ui/button";
import { useExpandableSidebar } from "@/hooks/use-expandable-sidebar";
import { TableMenu } from "@/editor/components/table-menu";
import { ShouldNotified } from "@/exception/interfaces/should-notified";
import { t } from "@/utils/lang";
import { toast } from "sonner";
import { FrozenChapter } from "@/components/editor/non-tiptap-editor/frozen-chapter";
import { prefetchAlias } from "@/editor/plugins/alias-hint-plugin";

export const Editor: React.FC = () => {
  const { zoom, showZoomUI, containerRef, zoomIn, zoomOut } = useZoom();

  const { id, version, chapter } = useParams<EditorParams>();

  const [loaded, setLoaded] = useState(false);
  const [config, setConfig] = useState<ConfigShape | null>(null);

  useEffect(() => {
    const off = Manager.app.on("migrating:deprecation", ({ fixed, node, id }) => {
      toast.info(`Auto Migrating for deprecated nodes`, {
        id,
        description: `found '${node.type}', found ${fixed} in totals`
      })
    })

    return () => { off() }
  }, []);

  useEffect(() => {
    return Manager.app.on("document:warmed", async () => {
      if(!(window.config.get()?.editor.aliasHint)) return
      await prefetchAlias()
    })
  }, [])

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
      // window
      if ("config" in window) {
        setConfig(window.config.get());
      }
      if (!alive) return;
      setLoaded(true);
    };

    init();

    return () => {
      alive = false;
    };
  }, [id, version, chapter]);

  const [showFind, setShowFind] = useState(false);
  const [showReplace, setShowReplace] = useState(false);

  const handleClose = useCallback(() => {
    setShowFind(false);
    setShowReplace(false);
  }, []);

  const handleToggleReplace = useCallback(() => {
    setShowReplace((v) => !v);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;

      if (mod && e.key === "f") {
        e.preventDefault();
        setShowFind(true);
      }

      if (mod && e.key === "h") {
        e.preventDefault();
        setShowFind(true);
        setShowReplace(true);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="max-h-full w-screen overflow-scroll bg-[#f1f3f5] dark:bg-black ">
      <div
        className={`w-full overflow-scroll h-full justify-between pt-4 ${config?.editor.scrollBar && "has-scrollbar"}`}
        id="main-scroll"
      >
        <NavBar />

        <div
          id="container"
          ref={containerRef}
          className="flex flex-col items-center py-3 space-y-2 px-5"
        >
          <ContextMenuPopup />
          <FindReplaceBar
            visible={showFind}
            showReplace={showReplace}
            onClose={handleClose}
            onToggleReplace={handleToggleReplace}
          />
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
              Chapter.instance.frozen ? <FrozenChapter /> :
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
      if (m.type == "layout:error") {
        throw new ShouldNotified({
          message: t("editor.error.pagging_stopped.title"),
          description: t("editor.error.pagging_stopped.description"),
        });
      }
    });
  }, []);

  const editor = useEditor({
    content: "",
    extensions: Chapter.instance!.extensions.get(),

    onCreate: async ({ editor }) => {
      let timer: any;

      // Document.current?.setContent(fixed as any)
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
              label: t("editor.context_menu.delete"),
              danger: true,
              icon: <TrashIcon className="h-4 w-4" />,
              onClick: () => editor.commands.deleteSelection(),
            },
            {
              label: t("editor.context_menu.see_in_preview"),
              icon: <Eye className="h-4 w-4" />,
              onClick: () => {
                const frame = document.querySelector("iframe");
                if (!frame) {
                  throw new FrameNotOpened({
                    message: t("error.frame.not.opened"),
                    description: t("error.frame.not.opened.desc"),
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

    onContentError: async (props) => {
      console.log(props.editor.getJSON(), props.error);
      await window.hightex.saveContentError({ content: props.editor.getJSON(), fileName: `${Document.instance?.id}-${Chapter.instance?.getId()}.json` })
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
      {(() => Chapter.instance?.getDecorator())()}
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
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-10 transition-all duration-300 ${visible
        ? "opacity-100 translate-y-0"
        : "opacity-0 translate-y-3 pointer-events-none"
        }`}
    >
      <div className="flex items-center gap-2 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-xl border border-neutral-200 dark:border-neutral-800 shadow-xl shadow-black/5 dark:shadow-black/30 rounded-2xl px-3 py-2 transition-colors duration-300">
        <button
          onClick={onZoomOut}
          className="text-sm px-2.5 py-1 rounded-lg text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        >
          −
        </button>

        <div className="text-xs w-12 text-center text-neutral-600 dark:text-neutral-400">
          {Math.round(zoom * 100)}%
        </div>

        <button
          onClick={onZoomIn}
          className="text-sm px-2.5 py-1 rounded-lg text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
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
