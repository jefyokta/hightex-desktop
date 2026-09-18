import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { PanelRightClose, PanelRightOpen, RefreshCw } from "lucide-react";

import {
  SidebarTab,
  tabs,
  useExpandableSidebar,
} from "@/hooks/use-expandable-sidebar";

interface TabErrorBoundaryProps {
  children: React.ReactNode;
  tabName: string;
}

interface TabErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class TabErrorBoundary extends React.Component<
  TabErrorBoundaryProps,
  TabErrorBoundaryState
> {
  constructor(props: TabErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): TabErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(
      `[Sidebar Error] Error in tab "${this.props.tabName}":`,
      error,
      errorInfo,
    );
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 flex flex-col gap-3 text-xs">
          <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 p-3 text-red-700 dark:text-red-400">
            <p className="font-semibold mb-1">
              Gagal memuat tab {this.props.tabName}
            </p>
            <p className="font-mono text-[11px] opacity-80 break-all">
              {this.state.error?.message || "Terjadi kesalahan pada komponen tab ini."}
            </p>
          </div>
          <button
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium hover:bg-muted transition-colors w-fit cursor-pointer"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            <RefreshCw className="h-3 w-3" />
            Coba Lagi
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export const ExpandableSideBar = () => {
  const { open, content, setContent, setOpen } = useExpandableSidebar();

  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  useEffect(() => {
    if (!open) return;

    const updateIndicator = () => {
      const el = tabRefs.current[content];
      if (!el) return;

      setIndicator({
        left: el.offsetLeft - 5,
        width: el.offsetWidth,
      });
    };

    updateIndicator();
    // Allow a tick for layout animation to settle
    const t = setTimeout(updateIndicator, 100);
    return () => clearTimeout(t);
  }, [content, open]);

  return (
    <div className="relative h-full border-r shrink-0 z-30">
      <button
        className="absolute top-4 -right-8 z-50 flex h-8 w-8 items-center justify-center rounded-r-md border border-l-0 bg-background hover:bg-muted shadow-sm cursor-pointer"
        onClick={() => setOpen((p) => !p)}
        title={open ? "Tutup Sidebar" : "Buka Sidebar"}
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
            <div className="relative flex overflow-x-scroll has-scrollbar items-center border-b px-2 py-2">
              {indicator.width > 0 && (
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
              )}

              {(Object.keys(tabs) as SidebarTab[]).map((key) => {
                const active = content === key;

                return (
                  <button
                    key={key}
                    ref={(el) => (tabRefs.current[key] = el)}
                    onClick={() => setContent(key)}
                    className={`relative z-10 px-3 py-2 text-xs capitalize transition-colors cursor-pointer ${
                      active
                        ? "text-foreground font-semibold"
                        : "text-muted-foreground dark:hover:text-neutral-100 hover:text-neutral-400"
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
                  {(() => {
                    const tab = tabs[content];
                    if (!tab) return null;
                    const Component = (tab as any).component;
                    return (
                      <TabErrorBoundary tabName={tab.name} key={content}>
                        {Component ? <Component /> : tab.element}
                      </TabErrorBoundary>
                    );
                  })()}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
