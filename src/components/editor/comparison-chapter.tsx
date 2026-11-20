import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { JSONContent } from "@tiptap/core";
import type { ImportedHighTexV2 } from "@hightex/importer";
import { renderChapterContent } from "@/editor/chapter/render-content";
import { Button } from "@/components/ui/button";
import { t } from "@/utils/lang";
import "@/css/editor.css";
import "katex/dist/katex.min.css";
import "@/css/branch-comparison.css";

export function ComparisonChapter({
  model,
  nodes,
  chapterId,
  side,
  changed,
}: {
  model: ImportedHighTexV2;
  nodes: JSONContent[];
  chapterId: string;
  side: "main" | "branch";
  changed: boolean[];
}) {
  const container = useRef<HTMLDivElement>(null);
  const paper = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.6);
  const [height, setHeight] = useState(1123);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useLayoutEffect(() => {
    if (!content.current) return;
    const root = content.current;
    let dispose: (() => void) | undefined;
    try {
      const rendered = renderChapterContent(root, model, nodes, chapterId);
      dispose = rendered.dispose;
      Array.from(root.children).forEach((element, index) => {
        if (changed[index])
          element.setAttribute(
            "data-compare-change",
            side === "main" ? "removed" : "added",
          );
      });
      const prefix = `comparison-${side}-${chapterId}-`;
      root.querySelectorAll<HTMLElement>("[id]").forEach((element) => {
        element.id = prefix + element.id;
      });
      root
        .querySelectorAll<HTMLAnchorElement>('a[href^="#"]')
        .forEach((link) => {
          link.setAttribute(
            "href",
            `#${prefix}${link.getAttribute("href")!.slice(1)}`,
          );
        });
      setFailed(false);
    } catch (error) {
      console.error("Could not render comparison chapter", error);
      root.replaceChildren();
      setFailed(true);
    }
    return () => {
      dispose?.();
      root.replaceChildren();
    };
  }, [model, nodes, chapterId, side, changed, retry]);
  useLayoutEffect(() => {
    const measure = () => {
      if (container.current && paper.current) {
        setScale(
          Math.min(
            1,
            Math.max(
              0.1,
              (container.current.clientWidth - 24) / paper.current.offsetWidth,
            ),
          ),
        );
        setHeight(paper.current.offsetHeight);
      }
    };
    const observer = new ResizeObserver(measure);
    if (container.current) observer.observe(container.current);
    if (paper.current) observer.observe(paper.current);
    measure();
    return () => observer.disconnect();
  }, []);
  const staticChapter = [
    "id",
    "en",
    "abstract",
    "abstract-en",
    "presentation",
    "foreword",
  ].includes(chapterId);
  return (
    <div
      ref={container}
      className="comparison-chapter min-w-0 overflow-hidden bg-muted/30 p-3"
      data-comparison-side={side}
    >
      {failed && (
        <div role="alert" className="space-y-2 p-4 text-sm">
          <p>{t("editor.branches.compare_render_failed")}</p>
          <Button
            variant="outline"
            onClick={() => setRetry((value) => value + 1)}
          >
            {t("forms.retry")}
          </Button>
        </div>
      )}
      <div
        className="relative mx-auto"
        style={{
          width: 794 * scale,
          height: failed ? 0 : height * scale,
          overflow: "hidden",
        }}
      >
        <div
          ref={paper}
          className={`page ${staticChapter ? "static-chapter" : chapterId === "attachment" ? "attachment-chapter" : "ch"}`}
          style={
            {
              "--start-counter": Number.isFinite(Number(chapterId))
                ? Math.max(0, Number(chapterId) - 1)
                : 0,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            } as CSSProperties
          }
        >
          <div
            ref={content}
            className="tiptap ProseMirror"
            role="document"
            onClick={(event) => {
              const link = (event.target as HTMLElement).closest("a");
              if (!link) return;
              event.preventDefault();
              const href = link.getAttribute("href");
              if (href?.startsWith("#"))
                content.current
                  ?.querySelector(`#${CSS.escape(href.slice(1))}`)
                  ?.scrollIntoView({ block: "nearest" });
            }}
          />
        </div>
      </div>
    </div>
  );
}
