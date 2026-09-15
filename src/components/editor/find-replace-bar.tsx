import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Search,
  X,
  ChevronUp,
  ChevronDown,
  CaseSensitive,
  Replace,
  ReplaceAll,
  ArrowLeftRight,
} from "lucide-react";
import { useCurrentEditor } from "@/hooks/use-editor";
import { t } from "@/utils/lang";
import { AnimatePresence, motion } from "motion/react";

type FindReplaceBarProps = {
  visible: boolean;
  showReplace: boolean;
  onClose: () => void;
  onToggleReplace: () => void;
};

export const FindReplaceBar: React.FC<FindReplaceBarProps> = ({
  visible,
  showReplace,
  onClose,
  onToggleReplace,
}) => {
  const { editor } = useCurrentEditor();

  const [searchTerm, setSearchTerm] = useState("");
  const [replaceTerm, setReplaceTerm] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [resultCount, setResultCount] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(-1);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const prevVisibleRef = useRef(false);

  // Sync match counts and current index with TipTap transactions
  useEffect(() => {
    if (!editor) return;

    const updateCounts = () => {
      const storage = (editor.storage as any)?.searchReplace;
      setResultCount(storage?.results?.length ?? 0);
      setCurrentIndex(storage?.currentIndex ?? -1);
    };

    editor.on("transaction", updateCounts);
    updateCounts();

    return () => {
      editor.off("transaction", updateCounts);
    };
  }, [editor]);

  // Focus the search input when the bar becomes visible
  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => searchInputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  // Update search in editor only when visible or when transitioning from visible to hidden
  useEffect(() => {
    if (!editor) return;

    if (visible) {
      if (searchTerm) {
        editor.commands.setSearchTerm(searchTerm);
      } else {
        editor.commands.clearSearch();
      }
    } else if (prevVisibleRef.current) {
      // Just became hidden
      editor.commands.clearSearch();
    }

    prevVisibleRef.current = visible;
  }, [searchTerm, visible, editor]);

  // Update case sensitivity
  useEffect(() => {
    if (!editor || !visible) return;
    editor.commands.setCaseSensitive(caseSensitive);
  }, [caseSensitive, editor, visible]);

  const handleNext = useCallback(() => {
    editor?.commands.nextSearchResult();
  }, [editor]);

  const handlePrev = useCallback(() => {
    editor?.commands.previousSearchResult();
  }, [editor]);

  const handleReplace = useCallback(() => {
    editor?.commands.replaceCurrentResult(replaceTerm);
  }, [editor, replaceTerm]);

  const handleReplaceAll = useCallback(() => {
    editor?.commands.replaceAllResults(replaceTerm);
  }, [editor, replaceTerm]);

  const handleClose = useCallback(() => {
    setSearchTerm("");
    editor?.commands.clearSearch();
    onClose();
  }, [editor, onClose]);

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (e.shiftKey) {
          handlePrev();
        } else {
          handleNext();
        }
      }
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      }
    },
    [handleNext, handlePrev, handleClose],
  );

  const handleReplaceKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleReplace();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      }
    },
    [handleReplace, handleClose],
  );

  if (!editor) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -12, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.97 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="
            fixed top-14 right-8 z-[9999]
            flex flex-col gap-2
            bg-white/95 dark:bg-neutral-900/95
            backdrop-blur-xl
            border border-neutral-200/80 dark:border-neutral-700/60
            rounded-xl
            shadow-[0_8px_32px_rgba(0,0,0,0.08)]
            dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)]
            p-3
            min-w-[340px]
          "
        >
          {/* Search Row */}
          <div className="flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500 shrink-0" />

            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder={t("editor.findReplace.find")}
              className="
                flex-1 min-w-0
                bg-transparent
                text-[13px]
                text-neutral-800 dark:text-neutral-200
                placeholder:text-neutral-400 dark:placeholder:text-neutral-600
                outline-none
                border-b border-transparent
                focus:border-neutral-300 dark:focus:border-neutral-600
                transition-colors
                py-1 px-1
              "
            />

            {/* Match counter */}
            {searchTerm && (
              <span className="text-[11px] text-neutral-500 dark:text-neutral-400 whitespace-nowrap tabular-nums px-1">
                {resultCount > 0
                  ? t("editor.findReplace.matchCount", {
                      current: String(currentIndex + 1),
                      total: String(resultCount),
                    })
                  : t("editor.findReplace.noResults")}
              </span>
            )}

            {/* Case sensitive toggle */}
            <BarButton
              title={t("editor.findReplace.caseSensitive")}
              active={caseSensitive}
              onClick={() => setCaseSensitive((v) => !v)}
            >
              <CaseSensitive className="w-3.5 h-3.5" />
            </BarButton>

            {/* Navigation */}
            <BarButton
              title="Previous (Shift+Enter)"
              onClick={handlePrev}
              disabled={resultCount === 0}
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </BarButton>

            <BarButton
              title="Next (Enter)"
              onClick={handleNext}
              disabled={resultCount === 0}
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </BarButton>

            {/* Toggle replace */}
            <BarButton
              title={t("editor.findReplace.replace")}
              active={showReplace}
              onClick={onToggleReplace}
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
            </BarButton>

            {/* Close */}
            <BarButton title="Close (Esc)" onClick={handleClose}>
              <X className="w-3.5 h-3.5" />
            </BarButton>
          </div>

          {/* Replace Row */}
          <AnimatePresence>
            {showReplace && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.15, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="flex items-center gap-1.5 pt-1 border-t border-neutral-100 dark:border-neutral-800">
                  <Replace className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500 shrink-0" />

                  <input
                    type="text"
                    value={replaceTerm}
                    onChange={(e) => setReplaceTerm(e.target.value)}
                    onKeyDown={handleReplaceKeyDown}
                    placeholder={t("editor.findReplace.replace")}
                    className="
                      flex-1 min-w-0
                      bg-transparent
                      text-[13px]
                      text-neutral-800 dark:text-neutral-200
                      placeholder:text-neutral-400 dark:placeholder:text-neutral-600
                      outline-none
                      border-b border-transparent
                      focus:border-neutral-300 dark:focus:border-neutral-600
                      transition-colors
                      py-1 px-1
                    "
                  />

                  <BarButton
                    title={t("editor.findReplace.replace")}
                    onClick={handleReplace}
                    disabled={resultCount === 0}
                  >
                    <Replace className="w-3.5 h-3.5" />
                  </BarButton>

                  <BarButton
                    title={t("editor.findReplace.replaceAll")}
                    onClick={handleReplaceAll}
                    disabled={resultCount === 0}
                  >
                    <ReplaceAll className="w-3.5 h-3.5" />
                  </BarButton>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Small icon button used in the bar
const BarButton: React.FC<{
  onClick: () => void;
  title?: string;
  disabled?: boolean;
  active?: boolean;
  children: React.ReactNode;
}> = ({ onClick, title, disabled, active, children }) => {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`
        flex items-center justify-center
        w-6 h-6
        rounded-md
        transition-colors duration-100
        disabled:opacity-30 disabled:cursor-not-allowed
        ${
          active
            ? "bg-neutral-200 dark:bg-neutral-700 text-neutral-900 dark:text-white"
            : "text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-700 dark:hover:text-neutral-200"
        }
      `}
    >
      {children}
    </button>
  );
};
