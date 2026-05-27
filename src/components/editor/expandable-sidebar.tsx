import { AnimatePresence, motion } from "motion/react";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  SidebarTab,
  tabs,
  useExpandableSidebar,
} from "@/hooks/use-expandable-sidebar";

export const ExpandableSideBar = () => {
  const { open, content, setContent, setOpen } = useExpandableSidebar();

  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  useEffect(() => {
    const el = tabRefs.current[content];
    if (!el) return;

    setIndicator({
      left: el.offsetLeft - 5,
      width: el.offsetWidth,
    });
  }, [content, open]);

  return (
    <div className="relative h-full border-r">
      <button
        className="absolute top-4 -right-8 z-2000 flex h-8 w-8 items-center justify-center rounded-r-md border border-l-0 bg-background hover:bg-muted"
        onClick={() => setOpen((p) => !p)}
      >
        {open ? (
          <PanelRightClose className="h-4 w-4" />
        ) : (
          <PanelRightOpen className="h-4 w-4" />
        )}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 320, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="flex h-full flex-col overflow-hidden border-l bg-background"
          >
            <div className="relative flex overflow-x-scroll items-center border-b px-2 py-2">
              <motion.div
                className="absolute top-2 bottom-2 rounded-md bg-muted"
                animate={{
                  x: indicator.left - 3,
                  width: indicator.width,
                }}
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 30,
                }}
              />

              {(Object.keys(tabs) as SidebarTab[]).map((key) => {
                const active = content === key;

                return (
                  <button
                    key={key}
                    ref={(el) => (tabRefs.current[key] = el)}
                    onClick={() => setContent(key)}
                    className={`relative z-10 px-3 py-2 text-xs capitalize transition-colors ${
                      active
                        ? "text-"
                        : "text-muted-foreground  dark:hover:text-neutral-100 hover:text-neutral-400"
                    }`}
                  >
                    {tabs[key].name.toLowerCase()}
                  </button>
                );
              })}
            </div>

            <div className="flex-1 overflow-auto pt-3 pb-20">
              <AnimatePresence mode="wait">
                <motion.div
                  key={content}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  className="h-full"
                >
                  {tabs[content].element}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
