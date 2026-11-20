import { useLayoutEffect, useRef, type RefObject } from "react";
import { useEditorState } from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import { paginationKey } from "@/editor/pagination";
import { Manager } from "@/editor/manager";
import {
  HEADING_PATH_PREFIX,
  scrollToHeadingPath,
} from "@/editor/chapter/heading-navigation";
import {
  SCANNER_DIAGNOSTIC_PREFIX,
  SCANNER_PARAGRAPH_PREFIX,
  decodeScannerDiagnostic,
  focusEditorDiagnostic,
  scrollToPunctuationParagraph,
} from "@/scanner/navigation";
import { toast } from "sonner";
import { t } from "@/utils/lang";

/** Follow a navigation target through initial layout; user input takes control immediately. */
export function useChapterTarget(
  editor: Editor | null,
  chapterId: string,
  target: string | undefined,
  ready: boolean,
  contentRef: RefObject<HTMLElement>,
) {
  const interrupted = useRef(false);
  const focused = useRef(false);
  const pending = useEditorState({
    editor,
    selector: ({ editor }) => {
      const state = editor && paginationKey.getState(editor.state);
      return Boolean(state?.enabled && state.pending);
    },
  });

  useLayoutEffect(() => {
    interrupted.current = false;
    focused.current = false;
  }, [chapterId, target]);

  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!ready || !editor || !content || interrupted.current) return;
    if (!target) {
      if (focused.current) return;
      const frame = requestAnimationFrame(() => {
        if (!editor.isDestroyed) {
          focused.current = true;
          editor.commands.focus(undefined, { scrollIntoView: false });
        }
      });
      return () => cancelAnimationFrame(frame);
    }
    let frame: number | undefined;
    const cancelFrame = () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
      frame = undefined;
    };
    const apply = () => {
      frame = undefined;
      if (interrupted.current || editor.isDestroyed || content.hidden || pending) return;
      if (target.startsWith(SCANNER_DIAGNOSTIC_PREFIX)) {
        if (focused.current) return;
        focused.current = true;
        const diagnostic = decodeScannerDiagnostic(target);
        if (diagnostic?.chapterId === chapterId)
          void focusEditorDiagnostic(editor, diagnostic).then(found => {
            if (!found)
              toast.info(t(diagnostic.source
                ? "editor.pagination.source_stale"
                : "editor.inline.scanner_stale"));
          });
      } else if (target.startsWith(SCANNER_PARAGRAPH_PREFIX)) {
        if (focused.current) return;
        focused.current = true;
        scrollToPunctuationParagraph(
          editor,
          Number(target.slice(SCANNER_PARAGRAPH_PREFIX.length)),
        );
      } else if (target.startsWith(HEADING_PATH_PREFIX)) {
        scrollToHeadingPath(editor, target);
      } else {
        Manager.scrollTo(target);
      }
    };
    const schedule = () => {
      cancelFrame();
      if (!interrupted.current && !pending) frame = requestAnimationFrame(apply);
    };
    const stop = () => {
      interrupted.current = true;
      cancelFrame();
      observer.disconnect();
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(content);
    content.addEventListener("load", schedule, true);
    const intents = ["wheel", "touchstart", "pointerdown", "keydown"] as const;
    for (const event of intents)
      document.addEventListener(event, stop, { capture: true, passive: true });
    schedule();
    return () => {
      cancelFrame();
      observer.disconnect();
      content.removeEventListener("load", schedule, true);
      for (const event of intents) document.removeEventListener(event, stop, true);
    };
  }, [editor, chapterId, target, ready, pending, contentRef]);
}
