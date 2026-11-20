import { renderToStaticMarkup } from "react-dom/server";
import {
  AbstractIndonesian,
  AbstractEnglish,
} from "@/compiler/sheets/abstracts";
import { AbstractIDBuilder } from "@/compiler/builder/abstract-id-builder";
import { AbstractENBuilder } from "@/compiler/builder/abstract-en-builder";
import { Document } from "@/editor/document";
import { PrintableContextProvider } from "@/hooks/use-printable";
import { resolveDocumentProfile } from "@/utils/document-profile";
import type { SectionCompositionDefinition } from "../../../shared/section-layout";

export function editorCompositionDefinition(
  template: HTMLElement,
  bodySelector: string,
  headingFromSource: boolean,
): SectionCompositionDefinition {
  const copy = template.cloneNode(true) as HTMLElement;
  const slot = copy.querySelector(bodySelector);
  if (!slot) throw Error("Missing editable template slot");
  let headingAnchor: string | undefined;
  if (headingFromSource) {
    const title = slot.previousElementSibling;
    if (!title?.matches("h1"))
      throw Error("Abstract template has no title slot");
    headingAnchor = title.id || undefined;
    title.remove();
  }
  return { html: copy.outerHTML, bodySelector, headingAnchor };
}

/** Render the existing abstract sheet for both the editing shell and compiler composition. */
export function abstractCompositionDefinition(
  data: HighTexDocument,
  category: Category,
  chapter: "abstract" | "abstract-en",
  headingFromSource: boolean,
): SectionCompositionDefinition {
  const context = Document.fromSnapshot(data, category),
    Sheet = chapter === "abstract" ? AbstractIndonesian : AbstractEnglish;
  const target =
    chapter === "abstract"
      ? new AbstractIDBuilder().target
      : new AbstractENBuilder().target;
  const holder = document.createElement("div");
  holder.innerHTML = renderToStaticMarkup(
    <PrintableContextProvider
      value={{
        document: context,
        profile: resolveDocumentProfile(data),
        ready: true,
        pageMode: "full",
        inFrame: false,
      }}
    >
      <Sheet />
    </PrintableContextProvider>,
  );
  if (!(holder.firstElementChild instanceof HTMLElement))
    throw Error("Missing abstract template");
  return editorCompositionDefinition(
    holder.firstElementChild,
    target.selector,
    headingFromSource,
  );
}
