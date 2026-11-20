import { renderToStaticMarkup } from "react-dom/server";
import type { NodeI } from "tjsn-parser";
import { Document } from "../../src/editor/document";
import { PrintableContextProvider } from "../../src/hooks/use-printable";
import { StaticPages } from "../../src/compiler/static-pages";
import { AbstractIDBuilder } from "../../src/compiler/builder/abstract-id-builder";
import { AbstractENBuilder } from "../../src/compiler/builder/abstract-en-builder";
import { createLegacyDocumentParser } from "../../src/compiler/parser";
import { resolveDocumentProfile } from "../../src/utils/document-profile";
import type { DocumentRenderModel } from "../../src/types/document-snapshot";
import "../../src/css/document-template.css";

/** Reference composition only. Never used by the replacement renderer or editor. */
export function legacyAbstractComposition(input: {
  document: HighTexDocument;
  category: Category;
  model: DocumentRenderModel;
}) {
  const context = Document.fromSnapshot(input.document, input.category);
  const FrontPages = StaticPages.create(input.category.variant ?? "thesis");
  const root = document.createElement("div");
  root.innerHTML = renderToStaticMarkup(
    <PrintableContextProvider value={{
      document: context,
      profile: resolveDocumentProfile(input.document),
      ready: true,
      pageMode: "full",
      inFrame: false,
    }}>
      <FrontPages />
    </PrintableContextProvider>,
  );
  const references: { chapter: string; section: HTMLElement; body: HTMLElement }[] = [];
  for (const { target } of [new AbstractIDBuilder(), new AbstractENBuilder()]) {
    const body = root.querySelector<HTMLElement>(target.selector);
    const chapter = context.chapters.find(chapter => chapter.getChapter() === target.chapterId);
    if (!body || !chapter) continue;
    const stored = input.model.chapters.find(chapter => chapter.id === target.chapterId);
    const source = chapter.sourceContent(stored?.content);
    const nodes = source[0]?.type === "heading" && source[0].attrs?.level === 1 ? source.slice(1) : source;
    createLegacyDocumentParser().render(nodes as NodeI[], body);
    references.push({ chapter: target.chapterId, body, section: body.closest("section")! });
  }
  return references;
}
