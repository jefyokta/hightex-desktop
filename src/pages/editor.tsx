import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useExpandableSidebar } from "@/hooks/use-expandable-sidebar";
import { TableMenu } from "@/editor/components/table-menu";
import { ShouldNotified } from "@/exception/interfaces/should-notified";
import { t } from "@/utils/lang";
import { toast } from "sonner";
import { FrozenChapter } from "@/components/editor/non-tiptap-editor/frozen-chapter";
import { BubbleMenu } from "@/components/editor/bubble-menu";
import { useConfig } from "@/hooks/use-config";
import { CommentSlave } from "@/slaves/comment-slave";
import { uniqId } from "@/utils/uniq-id";
import { ZoomUI } from "@/components/editor/zoom-ui";
import { LoadingDocument } from "@/components/editor/loading-document";
import { DocumentProfileNotice } from "@/components/editor/document-profile-notice";
import { DocumentNotFound } from "@/exception/document-not-found";
import { refreshCloudAcademic } from "@/cloud/academic-data";
import {
  SCANNER_PARAGRAPH_PREFIX,
  scrollToPunctuationParagraph,
  decodeScannerDiagnostic,
  focusScannerDiagnostic,
  SCANNER_DIAGNOSTIC_PREFIX,
} from "@/scanner/navigation";
export const Editor: React.FC = () => {
  const { zoom, showZoomUI, containerRef, zoomIn, zoomOut } = useZoom();

  const { id, version, chapter } = useParams<EditorParams>();
  const [loadedChapter, setLoadedChapter] = useState<Chapter | null>(null);
  const chapterId = `${id}.${chapter ?? "1"}${version ? `.${version}` : ""}`;
  const currentChapter =
    loadedChapter?.getId() === chapterId ? loadedChapter : null;
  const { config } = useConfig();

  const [editorKey, setEditorKey] = useState(uniqId());

  useEffect(() => {
    const off = Manager.app.on(
      "migrating:deprecation",
      ({ fixed, node, id }) => {
        toast.info(`Auto Migrating for deprecated nodes`, {
          id,
          description: `found '${node.type}', found ${fixed} in totals`,
        });
      },
    );

    return () => {
      off();
    };
  }, []);

  useEffect(() => {
    return Manager.app.on("chapter:reload", () => {
      setEditorKey(uniqId());
    });
  }, []);

  useEffect(() => {
    let alive = true;

    const init = async () => {
      setLoadedChapter(null);
      if (id && !version) await refreshCloudAcademic(id);
      if (!alive) return;
      const doc = await new Document(id!, version).warm({ activate: false });
      if (!alive) return;
      const currentChapter = doc.chapters.find(
        (c) => c.getChapter() == (chapter ?? 1),
      );
      if (!currentChapter) {
        console.log("chapter not found", chapter);
        throw new ChapterNotFound(chapter);
      }
      doc.activate();
      Document.setCurrentChapter(currentChapter);
      setLoadedChapter(currentChapter);
    };

    init().catch((e) => {
      if (e instanceof DocumentNotFound) {
        window;
      }
    });

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

      if (mod && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "s") {
        // Suppress the browser's Save Page action even while the editor is loading.
        e.preventDefault();
        return;
      }

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
          {currentChapter && id && <DocumentProfileNotice documentId={id} />}
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
            {currentChapter ? (
              currentChapter.frozen ? (
                <FrozenChapter key={`${id}.${chapter}`} />
              ) : (
                <EditorComponent
                  key={`${chapterId}:${editorKey}`}
                  chapter={currentChapter}
                />
              )
            ) : (
              <LoadingDocument />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const EditorComponent = ({ chapter }: { chapter: Chapter }) => {
  const { setEditor } = useCurrentEditor();
  const { params } = param();
  const navigationTargets = useRef(params);
  navigationTargets.current = params;
  const { config } = useConfig();
  const [ready, setReady] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const alive = useRef(true);
  const contentError = useRef(false);
  const commitTimer = useRef<ReturnType<typeof setTimeout>>();
  const navigationFrame = useRef<number>();
  const removeListeners = useRef<() => void>();
  const extensions = useMemo(
    () => chapter.extensions.get(config?.editor.aliasHint),
    [chapter, config?.editor.aliasHint],
  );

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
    editable: false,
    extensions,

    onCreate: async ({ editor }) => {
      let initialized: boolean;
      try {
        initialized = await Manager.emit("create", {
          editor,
          chapter,
          isCurrent: () => alive.current && !contentError.current,
        });
      } catch (error) {
        if (!alive.current || editor.isDestroyed) return;
        console.error("Unable to load chapter", error);
        setLoadFailed(true);
        return;
      }
      if (!initialized || !alive.current || editor.isDestroyed) return;

      setReady(true);
      setEditor(editor);
      const target = navigationTargets.current.pop();
      navigationFrame.current = requestAnimationFrame(() => {
        if (!alive.current || editor.isDestroyed) return;
        if (target) {
          if (target.startsWith(SCANNER_DIAGNOSTIC_PREFIX)) {
            const diagnostic = decodeScannerDiagnostic(target);
            if (
              diagnostic?.chapterId === chapter.getId() &&
              !focusScannerDiagnostic(editor, diagnostic)
            ) {
              toast.info("Temuan tidak lagi ditemukan. Jalankan scan ulang.");
            }
          } else if (target.startsWith(SCANNER_PARAGRAPH_PREFIX)) {
            scrollToPunctuationParagraph(
              editor,
              Number(target.slice(SCANNER_PARAGRAPH_PREFIX.length)),
            );
          } else {
            Manager.scrollTo(target);
          }
        } else {
          editor.commands.focus();
        }
      });
      const onInput = () => {
        clearTimeout(commitTimer.current);
        commitTimer.current = setTimeout(() => {
          if (!alive.current) return;
          Manager.app.dispatch("chapter:commit", {
            chapter,
          });
        }, 800);
      };
      const onContextMenu = (e: MouseEvent) => {
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
      };
      const root = editor.view.dom;
      root.addEventListener("input", onInput);
      root.addEventListener("contextmenu", onContextMenu);
      removeListeners.current = () => {
        root.removeEventListener("input", onInput);
        root.removeEventListener("contextmenu", onContextMenu);
      };
    },

    onUpdate: async ({ editor }) => {
      await Manager.emit("update", {
        editor,
      });
    },

    onContentError: async (props) => {
      contentError.current = true;
      setLoadFailed(true);
      console.log(props.editor.getJSON(), props.error);
      props.editor.setEditable(false);
      await window.hightex.saveContentError({
        content: props.editor.getJSON(),
        fileName: `${chapter.document.id}-${chapter.getId()}.json`,
      });
      throw new EditorContentError(props.editor);
    },
    enableContentCheck: true,
  });

  useLayoutEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      clearTimeout(commitTimer.current);
      if (navigationFrame.current !== undefined) {
        cancelAnimationFrame(navigationFrame.current);
      }
      removeListeners.current?.();
      if (editor) Manager.emit("destroy", { editor });
      setEditor((current) => (current === editor ? null : current));
    };
  }, [editor, setEditor]);

  return (
    <>
      {!ready &&
        (loadFailed ? (
          <Alert className="w-[21cm] max-w-full">
            <AlertTitle>{t("editor.error.load_failed.title")}</AlertTitle>
            <AlertDescription>
              <p>{t("editor.error.load_failed.description")}</p>
              <Button
                onClick={() => Manager.app.dispatch("chapter:reload", {})}
              >
                {t("editor.error.load_failed.retry")}
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          <LoadingDocument />
        ))}
      <div
        id="page"
        hidden={!ready}
        aria-busy={!ready}
        data-table-resize-guides={config?.editor?.tableResizeGuides ?? true}
        style={
          { "--start-counter": chapter.getNumber() } as React.CSSProperties
        }
        className={`page ${chapter.getHtmlClass()} bg-white dark:bg-neutral-900! rounded-md shadow-[0_8px_30px_rgba(0,0,0,0.06)]`}
      >
        <EditorContent
          spellCheck={config?.editor.spellCheck || false}
          lang={config?.language || "id-ID"}
          editor={editor}
        />
        {chapter.getDecorator()}
        <BubbleMenu editor={editor} />
        <TableMenu editor={editor} />
        <CommentSlave />
      </div>
    </>
  );
};
