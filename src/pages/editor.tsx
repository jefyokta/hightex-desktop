import React, { useEffect, useState } from "react";
import { NavBar } from "../components/editor/navbar";
import { EditorContent, useEditor } from "@tiptap/react";

import "./../css/editor.css";

import { useParams } from "react-router-dom";

import { EditorParams } from "../types/params/editor";
import { Manager } from "../editor/manager";

import { useZoom } from "../hooks/use-zoom";
import { Chapter } from "../editor/chapter/chapter";
import { useCurrentEditor } from "../hooks/use-editor";
import { EditorContentError } from "../exception/editor-content-error";
import { Document } from "@/editor/document";
import { ChapterNotFound } from "@/exception/chapter-not-found";

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
    <div className="h-screen w-screen flex flex-col bg-[#f1f3f5] pt-7">
      <div className="w-full overflow-scroll h-screen justify-between scrollbar-none">
        <NavBar />

        <div
          id="container"
          ref={containerRef}
          className="flex flex-col items-center py-3 space-y-2 scrollbar-none px-5"
        >
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

      <div className="w-10 h-10 rounded-full fixed bottom-4 right-4 border"></div>
    </div>
  );
};

const EditorComponent = () => {
  const { setEditor } = useCurrentEditor();

  const editor = useEditor({
    content: "",

    extensions: Chapter.instance!.extensions.get(),

    onCreate: async ({ editor }) => {
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
      throw new EditorContentError({
        message: props.error.message,
        editor: props.editor,
        prevError: props.error,
      });
    },

    enableContentCheck: true,
  });

  return (
    <div className="page bg-white rounded-md shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
      <EditorContent editor={editor} />
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
      <div className="flex items-center gap-2 bg-white/80 backdrop-blur border border-gray-100 shadow rounded-xl px-3 py-2">
        <button
          onClick={onZoomOut}
          className="text-sm px-2 py-1 rounded hover:bg-gray-100"
        >
          −
        </button>

        <div className="text-xs w-12 text-center text-gray-600">
          {Math.round(zoom * 100)}%
        </div>

        <button
          onClick={onZoomIn}
          className="text-sm px-2 py-1 rounded hover:bg-gray-100"
        >
          +
        </button>
      </div>
    </div>
  );
};

const LoadingDocument = () => {
  return (
    <div className="page bg-white rounded-md shadow-[0_8px_30px_rgba(0,0,0,0.06)] overflow-hidden">
      <div className=" py-14">
        <div className="animate-pulse">
          <div className="h-8 w-64 rounded bg-gray-100 mb-10" />

          <div className="space-y-4">
            <div className="h-3 rounded bg-gray-100 w-full" />
            <div className="h-3 rounded bg-gray-100 w-[95%]" />
            <div className="h-3 rounded bg-gray-100 w-[90%]" />
          </div>

          <div className="space-y-4 mt-10">
            <div className="h-3 rounded bg-gray-100 w-full" />
            <div className="h-3 rounded bg-gray-100 w-[92%]" />
            <div className="h-3 rounded bg-gray-100 w-[85%]" />
            <div className="h-3 rounded bg-gray-100 w-[88%]" />
          </div>

          <div className="space-y-4 mt-10">
            <div className="h-3 rounded bg-gray-100 w-full" />
            <div className="h-3 rounded bg-gray-100 w-[96%]" />
            <div className="h-3 rounded bg-gray-100 w-[82%]" />
          </div>
        </div>

        <div className="mt-12 flex items-center gap-2 text-xs text-gray-400">
          <div className="w-2 h-2 rounded-full bg-gray-300 animate-pulse" />
          Loading document...
        </div>
      </div>
    </div>
  );
};
