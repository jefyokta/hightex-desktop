import { Settings } from "lucide-react";
import { isMac } from "../utils/is-mac";
import Hightex from "./../assets/hightex.svg";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Manager } from "@/editor/manager";
import { ParsedItalic } from "@/utils/parse-italic";

export const Navbar = () => {
  const go = useNavigate();
  if (!isMac) return null;

  return (
    <div className="relative w-full h-14 bg-neutral-50 dark:bg-neutral-900 px-4 flex items-center border-b border-neutral-100 dark:border-neutral-800 transition-colors">
      <div className="flex-1 h-full drag-bar" />

      <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none flex items-center gap-2 text-neutral-900 dark:text-neutral-100">
        <img src={Hightex} className="w-8" />
        <span>HighTex</span>
      </div>

      <div
        onClick={() => go("/settings")}
        className="no-drag flex w-10 h-10 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 justify-center cursor-pointer items-center transition-colors"
      >
        <button>
          <Settings
            size={20}
            className="text-neutral-500 dark:text-neutral-400"
          />
        </button>
      </div>
    </div>
  );
};

export const MacosEditorHead: React.FC = () => {
  const [doc, setDoc] = useState<HighTexDocument | undefined>();
  useEffect(() => {
    const updateListener = Manager.app.on(
      "document:updated",
      ({ document }) => {
        setDoc((current) => (document.id === current?.id ? document : current));
      },
    );
    const warmListener = Manager.app.on("document:warmed", ({ document }) => {
      const createdDoc = document.getDocument();
      setDoc(createdDoc);
    });

    return () => {
      warmListener();
      updateListener();
    };
  }, []);

  if (!isMac) return null;
  return (
    <div
      data-editor-titlebar
      className="relative z-[2200] flex h-14 shrink-0 select-none items-center justify-center border-b bg-background px-24"
    >
      <div data-editor-window-title className="max-w-md truncate">
        <ParsedItalic text={doc?.title ?? ""} />
      </div>
    </div>
  );
};
