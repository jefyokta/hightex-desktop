import type { DocumentPage } from "@/types/document-engine";
import type { PaginationGeometry } from "@/editor/pagination/options";
import type { SectionSourceLocator } from "../../../shared/section-layout";

/** Completed layout input; page descriptors do not need a compiler or live editor. */
export interface ChapterPageInput {
  paper: HTMLElement;
  root: HTMLElement;
  pages: number;
  sources: readonly SectionSourceLocator[];
}

/** Group measured anchors once; this adapter never chooses page breaks. */
export function chapterPages(
  input: ChapterPageInput,
  geometry: PaginationGeometry,
): DocumentPage[] {
  const { paper, root, sources } = input;
  const sourceNodes = new Map<string, SectionSourceLocator>();
  for (const source of sources)
    if (source.nodeId && !sourceNodes.has(source.nodeId)) sourceNodes.set(source.nodeId, source);
  const sourceOf = (node: Element) => {
    for (
      let element: Element | null = node;
      element && root.contains(element);
      element = element.parentElement
    ) {
      const source = sourceNodes.get(element.id);
      if (source) return source;
    }
  };
  const pages = Array.from({ length: input.pages }, (_, index) => {
    const element = document.createElement("div");
    const content = document.createElement("div");
    element.className = "editor-page-fragment";
    element.style.cssText = `position:relative;width:${geometry.width}px;height:${geometry.height}px`;
    element.append(content);
    return {
      element,
      content,
      sourceOf,
      targets: [] as HTMLElement[],
      links: [] as HTMLAnchorElement[],
      projection: { context: paper, page: index + 1, pages: input.pages, geometry },
    } satisfies DocumentPage;
  });
  const origin = paper.getBoundingClientRect();
  for (const node of root.querySelectorAll<HTMLElement>("[id],a[href]")) {
    const index = Math.floor((node.getBoundingClientRect().top - origin.top) / geometry.stride);
    const page = pages[index];
    // Only physical pages own link/target descriptors.
    if (!page) continue;
    if (node.hasAttribute("id")) page.targets.push(node);
    if (node.matches("a[href]")) page.links.push(node as HTMLAnchorElement);
  }
  return pages;
}
