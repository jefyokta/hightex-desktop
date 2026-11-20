import { chapterVariables } from "./variables";
import { chapterRenderContext } from "./render-context";
import { renderMathBlock } from "../extensions/math/render-block";
import type { JSONContent } from "@tiptap/core";
import type { DocumentRenderModel } from "@/types/document-snapshot";
import { renderToStaticMarkup } from "react-dom/server";
import {
  mathPresentation,
  MathInlinePresentation,
} from "../extensions/math/presentation";
import { createElement } from "react";
import { ChapterExtensions } from "./chapter-extensions";
import { isReferenceKind } from "../extensions/ref/label";
import { headerLikeRowIndexes } from "../plugins/table-border";
import { VariablePresentation } from "../extensions/variable/presentation";
import type { VariableCase } from "../extensions/variable";
import {
  citationFallback,
  resolveCitation,
} from "../extensions/citation/resolve";
import { editorNonContentSelector } from "../pagination/presentation/decorations";
import type { ChapterRenderIssue } from "@/types/chapter-content";
import { ChapterImageResources } from "./image-resources";
import {
  normalizeDocumentLinks,
  referenceFallback,
} from "@/document-engine/link-presentation";
import { missingImage } from "../extensions/image/fallback";
import { presentCitation } from "../extensions/citation/presentation";
import type { SectionSourceLocator } from "../../../shared/section-layout";

/**
 * Read-only rendering shared with branch comparison. Inputs are an immutable
 * document model; this does not load storage, activate an editor, or plan PDF pages.
 * The caller owns the root and must dispose resource URLs when it is discarded.
 * Recoverable input issues retain visible fallbacks. Callers wait for image
 * decoding and font readiness before measuring that presentation.
 */
export function renderChapterContent(
  root: HTMLElement,
  model: DocumentRenderModel,
  nodes: JSONContent[],
  chapterId: string,
) {
  const name =
    ({ id: "abstract", en: "abstract-en" } as Record<string, string>)[
      chapterId
    ] ?? chapterId;
  try {
    root.innerHTML = ChapterExtensions.serializeContent(name, nodes);
    return resolveChapterContent(root, model);
  } catch (error) {
    root.replaceChildren();
    throw error;
  }
}

/** Resolve existing schema DOM without replacing ProseMirror's source bindings. */
export function resolveChapterContent(
  root: HTMLElement,
  model: DocumentRenderModel,
  context = chapterRenderContext(model),
  imageResources?: Pick<ChapterImageResources, "url">,
  sourceOf?: (element: Node) => SectionSourceLocator | undefined,
) {
  const ownedImages = imageResources
    ? undefined
    : new ChapterImageResources(model.images);
  const images = imageResources ?? ownedImages!;
  const issues: ChapterRenderIssue[] = [];
  const report = (
    kind: ChapterRenderIssue["kind"],
    key: string,
    element: Element,
  ) => {
    const source = sourceOf?.(element);
    issues.push({ kind, key, ...(source ? { source } : {}) });
  };
  const dispose = () => {
    ownedImages?.dispose();
  };
  try {
    normalizeDocumentLinks(root);
    const { graphs, equations, referenceLabels, captionLabels } = context;
    root.querySelectorAll<HTMLElement>("figure[id]").forEach((figure) => {
      const caption = figure.querySelector("figcaption");
      const label = captionLabels.get(figure.id);
      if (caption && label) caption.dataset.label = label;
    });
    root
      .querySelectorAll<HTMLElement>('a[data-type="ref-component"]')
      .forEach((link) => {
        const target = link.getAttribute("data-link") ?? "";
        const kind = link.getAttribute("data-ref") || "imageFigure";
        const known = isReferenceKind(kind);
        const label = known ? referenceLabels[kind].get(target) : undefined;
        if (!label || !target) {
          report("reference", target, link);
          referenceFallback(link);
          return;
        }
        link.dataset.status = "ready";
        link.textContent = label;
        // Serialized labels are presentation caches, never numbering authority.
        link.removeAttribute("data-label");
      });
    root.querySelectorAll<HTMLImageElement>("img").forEach((image) => {
      if (image.matches(editorNonContentSelector)) return;
      const key = image.getAttribute("data-image-id") ?? "";
      const url = images.url(key);
      if (url) image.src = url;
      else {
        report("image", key, image);
        missingImage(image);
      }
    });
    root.querySelectorAll<HTMLTableElement>("table").forEach((table) => {
      if (
        table
          .closest('figure[data-type="figureTable"]')
          ?.querySelector("table") === table
      )
        table.dataset.type = "table";
      else {
        table.dataset.type = "grid";
        if (!table.parentElement?.classList.contains("node-grid"))
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
        table.dataset.type === "table",
      )) {
        for (const cell of Array.from(rows[index].cells))
          cell.classList.add("table-header-like");
      }
    });
    const variables = chapterVariables(model);
    root.querySelectorAll<HTMLElement>("[data-variable]").forEach((element) => {
      const name = element.dataset.name ?? "";
      if (!variables.has(name)) report("variable", name, element);
      element.innerHTML = renderToStaticMarkup(
        createElement(VariablePresentation, {
          value: variables.get(name) ?? "",
          mode: (element.dataset.case ?? "preserve") as VariableCase,
        }),
      );
    });
    root.querySelectorAll<HTMLElement>("cite").forEach((element) => {
      const keys = (element.getAttribute("cite") ?? "")
        .split("|")
        .filter(Boolean);
      const manual = element.getAttribute("manual") === "true";
      try {
        const text = resolveCitation(
          {
            cite: keys.join("|"),
            manual,
            text: element.getAttribute("text") ?? "",
            year: element.getAttribute("year") ?? "",
            citeA: element.hasAttribute("citea"),
          },
          keys
            .filter((key) => model.references[key])
            .map((key) => ({ key, bib: model.references[key] })),
        );
        presentCitation(element, text, "ready");
      } catch {
        report("citation", keys.join("|"), element);
        presentCitation(element, citationFallback(keys.join("|")), "error");
      }
    });
    root
      .querySelectorAll<HTMLElement>("[data-latex],[data-math-inline]")
      .forEach((element) => {
        const latex =
          element.dataset.latex ?? element.getAttribute("latex") ?? "";
        const block = element.hasAttribute("data-latex");
        const content = mathPresentation(latex, block);
        if (content.invalid) report("math", latex, element);
        element.innerHTML = block
          ? content.html
          : renderToStaticMarkup(
              createElement(MathInlinePresentation, { html: content.html }),
            );
      });
    root.querySelectorAll<HTMLElement>("[data-latex]").forEach((element) => {
      const equation = equations.find(
        (item) => item.id && item.id === element.id,
      );
      if (!equation) {
        report("math", element.id, element);
        renderMathBlock(element);
        return;
      }
      renderMathBlock(element, equation.pos);
    });
    return {
      issues,
      dispose,
      headings: graphs.flatMap((graph) => graph.headings),
    };
  } catch (error) {
    dispose();
    root.replaceChildren();
    throw error;
  }
}
