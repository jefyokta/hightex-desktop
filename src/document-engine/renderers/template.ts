import type { DocumentAssetResolver } from "../resources/contracts";
import { waitForPrintImages } from "@/compiler/print-resources";
import { waitForContentFonts } from "@/document-engine/resources/fonts";
import {
  sectionGeometry,
  type PaginationGeometry,
} from "@/editor/pagination/options";
import { abortable } from "@/utils/abortable";
import { normalizeDocumentLinks } from "../link-presentation";
import { missingImage } from "@/editor/extensions/image/fallback";
import { fillIndexLeaders } from "../indexes/index-leaders";
import { outlineTitle } from "../indexes/outline-title";
import { sectionGroup } from "@/utils/section-options";
import type {
  RenderedSection,
  SectionRenderContext,
  SectionRenderer,
  TemplateSection,
} from "@/types/document-engine";

/** Native HTML/CSS fragmentation for category templates; never creates an editor. */
export class TemplateSectionRenderer implements SectionRenderer<TemplateSection> {
  constructor(
    private readonly geometry: PaginationGeometry,
    private readonly resources: DocumentAssetResolver,
  ) {}

  async render(
    section: TemplateSection,
    { signal }: SectionRenderContext,
  ): Promise<RenderedSection> {
    const geometry = sectionGeometry(this.geometry, section.options);
    const { contentWidth, contentHeight, gap, width, height, margins } =
      geometry;
    const host = document.createElement("div"),
      source = document.createElement("div");
    host.style.cssText = "position:absolute;left:-100000px;top:0";
    source.className = "document-template-content";
    source.style.width = `${contentWidth}px`;
    source.style.height = `${contentHeight}px`;
    source.style.columnWidth = `${contentWidth}px`;
    source.style.columnGap = `${gap}px`;
    source.innerHTML = section.html;
    normalizeDocumentLinks(source);
    // These classes describe legacy print boundaries, not a content element.
    for (const element of source.querySelectorAll(".page-break,.new-page"))
      element.classList.remove("page-break", "new-page");
    for (const element of source.querySelectorAll("[contenteditable]"))
      element.removeAttribute("contenteditable");
    host.append(source);
    document.body.append(host);
    const pages: { element: HTMLElement; content: HTMLElement }[] = [];
    const issues = [...(section.issues ?? [])];
    const recoverImage = (image: HTMLImageElement) => {
      issues.push({
        kind: "image",
        key:
          image.getAttribute("data-image-id") ||
          image.getAttribute("src") ||
          "",
      });
      missingImage(image);
    };
    try {
      for (const image of source.querySelectorAll("img")) {
        if (!image.getAttribute("src")) {
          recoverImage(image);
          continue;
        }
        try {
          image.src = await this.resources.data(image.src);
        } catch {
          signal.throwIfAborted();
          recoverImage(image);
        }
      }
      await waitForPrintImages(source, signal, recoverImage);
      await waitForContentFonts(source, signal);
      await abortable(document.fonts.ready, signal);
      if (section.index) fillIndexLeaders(source);
      signal.throwIfAborted();
      const origin = source.getBoundingClientRect(),
        stride = contentWidth + gap;
      let count = Math.max(
        1,
        Math.ceil((source.scrollWidth + gap - 0.5) / stride),
      );
      const validate = (box: DOMRect, label: string) => {
        if (!box.width || !box.height) return;
        const column = Math.max(
          0,
          Math.floor((box.left - origin.left + 0.5) / stride),
        );
        count = Math.max(count, column + 1);
        if (
          box.top < origin.top - 2 ||
          box.bottom > origin.top + contentHeight + 2 ||
          box.left < origin.left + column * stride - 2 ||
          box.right > origin.left + column * stride + contentWidth + 2
        )
          throw Error(
            `Template ${section.id}, page ${column + 1}: content exceeds its page near ${JSON.stringify(label)}; ` +
              `bounds x=${(box.left - origin.left - column * stride).toFixed(2)}..${(box.right - origin.left - column * stride).toFixed(2)}, ` +
              `y=${(box.top - origin.top).toFixed(2)}..${(box.bottom - origin.top).toFixed(2)}; ` +
              `content ${contentWidth.toFixed(2)}×${contentHeight.toFixed(2)}px`,
          );
      };
      for (const image of source.querySelectorAll("img"))
        validate(image.getBoundingClientRect(), image.alt || "image");
      const walker = document.createTreeWalker(source, NodeFilter.SHOW_TEXT);
      let text: Node | null;
      while ((text = walker.nextNode())) {
        if (!text.textContent?.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(text);
        for (const box of range.getClientRects())
          validate(box, text.textContent.slice(0, 80));
      }
      if (count > 1000) throw Error("Template exceeds the page budget");
      const outline = Array.from(
        source.querySelectorAll<HTMLElement>("h1[id]"),
        (heading) => ({
          id: heading.id,
          ...outlineTitle(heading),
          number: "",
          level: 1,
          kind: "heading" as const,
          group: sectionGroup(section),
        }),
      );
      const anchorColumns = new Map<string, number>();
      for (const node of source.querySelectorAll<HTMLElement>("[id]")) {
        if (anchorColumns.has(node.id)) continue;
        const box = node.getClientRects()[0] ?? node.getBoundingClientRect();
        anchorColumns.set(
          node.id,
          Math.max(0, Math.floor((box.left - origin.left + 0.5) / stride)),
        );
      }
      for (let column = 0; column < count; column++) {
        signal.throwIfAborted();
        const element = document.createElement("div"),
          viewport = document.createElement("div");
        element.className = "editor-page-fragment document-template-page";
        element.dataset.sectionRenderer = "template";
        element.style.width = `${width}px`;
        element.style.height = `${height}px`;
        element.style.padding = `${margins.top}px ${margins.right}px ${margins.bottom}px ${margins.left}px`;
        viewport.className = "document-template-viewport";
        viewport.style.width = `${contentWidth}px`;
        viewport.style.height = `${contentHeight}px`;
        const content = source.cloneNode(true) as HTMLElement;
        content.style.left = `${-column * stride}px`;
        for (const node of content.querySelectorAll<HTMLElement>("[id]"))
          if (anchorColumns.get(node.id) !== column) node.removeAttribute("id");
        viewport.append(content);
        element.append(viewport);
        host.append(element);
        pages.push({ element, content });
      }
      source.remove();
      return {
        pages,
        issues,
        outline: section.numbering === "none" ? [] : outline,
        identity: { html: section.html, pages: count, geometry },
        destroy() {
          pages.forEach((page) => page.element.remove());
          host.remove();
        },
      };
    } catch (error) {
      host.remove();
      throw error;
    }
  }
}
