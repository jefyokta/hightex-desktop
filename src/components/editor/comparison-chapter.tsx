import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { generateHTML, type JSONContent } from "@tiptap/core";
import type { ImportedHighTexV2 } from "@hightex/importer";
import katex from "katex";
import { ChapterExtensions } from "@/editor/chapter/chapter-extensions";
import { headerLikeRowIndexes } from "@/editor/plugins/table-border";
import { Note } from "@/editor/extensions/note";
import { applyCase } from "@/utils/apply-var-case";
import type { VariableCase } from "@/editor/extensions/variable";
import { getProfileVariables } from "@/utils/document-profile";
import { formatInTextCitation, formatManual } from "@/utils/citation";
import { parseItalic } from "@/utils/parse-italic";
import { Symbols } from "@/utils/symbol";
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
    const urls: string[] = [];
    try {
      const name =
        ({ id: "abstract", en: "abstract-en" } as Record<string, string>)[
        chapterId
        ] ?? chapterId;
      const extensions = ChapterExtensions.contentSchema(name).filter(
        (extension) => extension.name !== "note",
      );
      extensions.push(
        Note.extend({
          renderHTML({ HTMLAttributes }) {
            return ["abbr", { title: HTMLAttributes["data-note"] ?? "" }, 0];
          },
        }),
      );
      root.innerHTML = generateHTML(
        { type: "doc", content: nodes },
        extensions,
      );
      Array.from(root.children).forEach((element, index) => {
        if (changed[index])
          element.setAttribute(
            "data-compare-change",
            side === "main" ? "removed" : "added",
          );
      });
      const figures = new Map<string, string>();
      const inspect = (nodes: JSONContent[]) =>
        nodes.forEach((node) => {
          if (node.attrs?.figureId && node.attrs.id)
            figures.set(String(node.attrs.figureId), String(node.attrs.id));
          if (node.content) inspect(node.content);
        });
      inspect(nodes);
      const referenceLabels = new Map<string, string>();
      for (const chapter of model.chapters) {
        let image = 0,
          table = 0,
          equation = 0;
        const headings = [Math.max(0, Number(chapter.id) - 1) || 0, 0, 0];
        const collect = (nodes: JSONContent[]) =>
          nodes.forEach((node) => {
            let label = "";
            if (node.type === "imageFigure")
              label = `Gambar ${chapter.id}.${++image}`;
            if (node.type === "figureTable")
              label = `Tabel ${chapter.id}.${++table}`;
            if (node.type === "blockMath")
              label = t("node.reference.label", {
                node: t("node.reference.equation"),
                number: `${chapter.id}.${++equation}`,
              });
            if (node.type === "heading" && node.attrs?.level <= 3) {
              const level = Math.max(1, Number(node.attrs?.level));
              headings[level - 1]++;
              for (let i = level; i < 3; i++) headings[i] = 0;
              label = headings
                .slice(0, level)
                .filter((value) => value > 0)
                .join(".");
            }
            if (label) {
              if (node.attrs?.id)
                referenceLabels.set(String(node.attrs.id), label);
              if (node.attrs?.figureId)
                referenceLabels.set(String(node.attrs.figureId), label);
            }
            if (node.content) collect(node.content);
          });
        collect(chapter.content);
      }
      root
        .querySelectorAll<HTMLElement>("figure[data-figureid]")
        .forEach((figure) => {
          const id = figures.get(figure.dataset.figureid ?? "");
          if (id) figure.id = id;
          const caption = figure.querySelector("figcaption");
          const label = referenceLabels.get(figure.id);
          if (caption && label) caption.dataset.label = label;
        });
      root
        .querySelectorAll<HTMLElement>('a[data-type="ref-component"]')
        .forEach((link) => {
          const explicit = link.getAttribute("data-label");
          if (explicit && explicit !== "false") return;
          link.textContent =
            referenceLabels.get(link.getAttribute("data-link") ?? "") ?? "[?]";
        });
      root.querySelectorAll<HTMLImageElement>("img").forEach((image) => {
        const key = image.getAttribute("data-image-id") ?? "";
        const asset = model.images[key];
        if (asset) {
          const url = URL.createObjectURL(
            new Blob([new Uint8Array(asset.bytes)], { type: asset.mime }),
          );
          urls.push(url);
          image.src = url;
        } else if (
          /^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=\s]+$/i.test(key)
        )
          image.src = key;
        else {
          image.removeAttribute("src");
          image.alt = t("submission_review.missing_image");
        }
      });
      root.querySelectorAll<HTMLTableElement>("table").forEach((table) => {
        if (table.closest('figure[data-type="figureTable"]'))
          table.dataset.type = "table";
        else {
          table.dataset.type = "grid";
          table.classList.add("node-grid");
        }
        const rows = Array.from(table.rows);
        for (const index of headerLikeRowIndexes(
          rows.map((row) =>
            Array.from(row.cells).map((cell) => ({
              header: cell.tagName === "TH",
              rowspan: cell.rowSpan,
            })),
          ),
        )) {
          for (const cell of Array.from(rows[index].cells))
            cell.classList.add("table-header-like");
        }
      });
      const variables = new Map<string, string>([
        ...Symbols.map(([name, value]) => [name, value] as [string, string]),
        ...model.variables.map(
          (row) => [row.name, row.value] as [string, string],
        ),
        ...Object.entries(getProfileVariables(model.profile)),
      ]);
      variables.set("title", model.document.title);
      variables.set("altTitle", model.document.altTitle);
      root
        .querySelectorAll<HTMLElement>("[data-variable]")
        .forEach((element) => {
          const value = applyCase(
            variables.get(element.dataset.name ?? "") ?? "",
            (element.dataset.case ?? "preserve") as VariableCase,
          );
          element.replaceChildren(
            ...parseItalic(value).map((part) => {
              if (part.type !== "italic")
                return document.createTextNode(part.text);
              const em = document.createElement("em");
              em.textContent = part.text;
              return em;
            }),
          );
        });
      root.querySelectorAll<HTMLElement>("cite").forEach((element) => {
        const keys = (element.getAttribute("cite") ?? "")
          .split("|")
          .filter(Boolean);
        try {
          element.textContent =
            element.getAttribute("manual") === "true"
              ? formatManual(
                element.getAttribute("text") ?? "",
                element.getAttribute("year") ?? "",
                element.hasAttribute("citea"),
              )
              : formatInTextCitation(
                keys.map((key) => ({ key, bib: model.references[key] })),
                element.hasAttribute("citea"),
              ).inText;
        } catch {
          element.textContent = `[${keys.join("; ") || "?"}]`;
        }
      });
      root
        .querySelectorAll<HTMLElement>("[data-latex],[data-math-inline]")
        .forEach((element) => {
          element.innerHTML = katex.renderToString(
            element.dataset.latex ?? element.getAttribute("latex") ?? "",
            {
              throwOnError: false,
              displayMode: element.hasAttribute("data-latex"),
              trust: false,
              maxExpand: 1000,
              maxSize: 10,
            },
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
      urls.forEach((url) => URL.revokeObjectURL(url));
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
