import type { EditorView } from "@tiptap/pm/view";
import type {
  SectionLayoutIdentity,
  SectionSourceLocator,
} from "../../../shared/section-layout";
import type { SectionViewportGeometry } from "./section-viewport";
import { contentAssets } from "@/utils/content-assets";
import { sectionSourceLocator } from "../layout/source-locator";
import { documentLinkTarget } from "../../../shared/document-link";

/** Derive anchor ownership from frozen chapter sources, without consulting stored labels. */
export function documentSourceTargets(chapters: HighTexChapter[]) {
  const owners = new Map<string, string>();
  for (const chapter of chapters)
    for (const id of contentAssets([chapter]).anchors) {
      if (!owners.has(id)) owners.set(id, chapter.id);
    }
  return owners;
}

/** Source positions remain model coordinates; page coordinates describe the resolved context. */
export function sectionSourceMap(
  view: EditorView,
  identity: SectionLayoutIdentity,
  geometry: SectionViewportGeometry,
  sourceTargets: ReadonlyMap<string, string> = new Map(),
  derivedAnchors: readonly { from: number; to: number; id: string }[] = [],
) {
  const paper = view.dom.closest<HTMLElement>(".page");
  if (!paper) throw Error("Missing resolved source surface");
  const origin = paper.getBoundingClientRect(),
    scale = origin.width / geometry.width;
  const sources: SectionSourceLocator[] = [];
  const ids = new Map<string, SectionSourceLocator>(),
    nodes = new Map<Node, SectionSourceLocator>();
  view.state.doc.descendants((node, from) => {
    const source = sectionSourceLocator(
      view.state.doc,
      identity,
      from,
      from + node.nodeSize,
    );
    sources.push(source);
    if (typeof node.attrs.id === "string" && node.attrs.id) {
      if (!ids.has(node.attrs.id)) ids.set(node.attrs.id, source);
    }
    const dom = view.nodeDOM(from);
    if (dom) nodes.set(dom, source);
  });
  for (const anchor of derivedAnchors)
    if (!ids.has(anchor.id))
      ids.set(
        anchor.id,
        sectionSourceLocator(view.state.doc, identity, anchor.from, anchor.to),
      );
  const place = (box: DOMRect) => {
    const top = (box.top - origin.top) / scale,
      index = Math.floor(top / geometry.stride);
    return {
      page: index + 1,
      x: (box.left - origin.left) / scale,
      y: top - index * geometry.stride,
      width: box.width / scale,
      height: box.height / scale,
    };
  };
  const locate = (link: HTMLElement) => {
    const direct = nodes.get(link);
    if (direct) return direct;
    const position = view.posAtDOM(link, 0, -1);
    const source = sources
      .filter((source) => source.from <= position && source.to > position)
      .sort((left, right) => left.to - left.from - (right.to - right.from))[0];
    if (!source) throw Error(`No source locator for link at ${position}`);
    return source;
  };
  const seen = new Set<string>();
  const targets = Array.from(view.dom.querySelectorAll<HTMLElement>("[id]"))
    .filter((node) => {
      if (seen.has(node.id)) return false;
      seen.add(node.id);
      return true;
    })
    .map((node) => {
      const source = ids.get(node.id);
      if (!source)
        throw Error(`Rendered anchor has no source node: ${node.id}`);
      return { id: node.id, ...place(node.getBoundingClientRect()), source };
    });
  const links = Array.from(
    view.dom.querySelectorAll<HTMLAnchorElement>('a[href^="#"]'),
  )
    .filter((link) => {
      const id = documentLinkTarget(link.getAttribute("href") ?? "");
      return !!id && (ids.has(id) || sourceTargets.has(id));
    })
    .flatMap((link) =>
      Array.from(link.getClientRects()).map((box) => ({
        target: documentLinkTarget(link.getAttribute("href")!)!,
        ...place(box),
        source: locate(link),
      })),
    );
  const crossSectionTargets = Array.from(
    new Set(links.map((link) => link.target)),
  )
    .filter((id) => !ids.has(id))
    .map((id) => {
      const chapterId = sourceTargets.get(id);
      if (
        !chapterId ||
        chapterId === identity.sectionId ||
        !chapterId.startsWith(`${identity.documentId}.`)
      )
        throw Error(`Rendered link has no resolved source target: ${id}`);
      return { id, chapterId };
    });
  return { sources, targets, crossSectionTargets, links };
}
