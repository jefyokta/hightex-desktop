import { Settings } from "lucide-react";
import { isMac } from "../utils/is-mac";
import Hightex from "./../assets/hightex.svg";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Manager } from "@/editor/manager";

export const Navbar = () => {
  if (!isMac) {
    return null;
  }

  const go = useNavigate();

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
  if (!isMac) {
    return null;
  }

  const [doc, setDoc] = useState<HighTexDocument | undefined>();
  useEffect(() => {
    const updateListener = Manager.app.on(
      "document:updated",
      ({ document }) => {
        if (document.id == doc?.id) {
          setDoc(document);
        }
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

  return (
    <div className="h-14 dragable top-0 border flex justify-center items-center ">
      <div className="truncate max-w-md">{doc?.title}</div>
    </div>
  );
};
