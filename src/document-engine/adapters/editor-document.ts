import type { DocumentAssetResolver, DocumentPresentation } from "../resources/contracts";
import type { DocumentRenderModel } from "@/types/document-snapshot";
import type { DocumentEngineOptions } from "@/types/document-engine";
import {
  sectionGeometry,
  type PaginationGeometry,
} from "@/editor/pagination/options";
import { paginationPageNumber } from "@/editor/pagination/presentation/decorations";
import { DocumentEngine } from "..";
import { EditorSectionRenderer } from "../renderers/editor";
import { TemplateSectionRenderer } from "../renderers/template";
import "@/css/document-template.css";
import "@/css/toc.css";
import "@/css/bibliography.css";
import type { SectionLayoutCache } from "../layout/layout-cache";

/** Application wiring, kept outside the engine's lifecycle and event contract. */
export function createEditorDocumentEngine(
  geometry: PaginationGeometry,
  model: DocumentRenderModel,
  resources: DocumentAssetResolver & DocumentPresentation,
  options?: DocumentEngineOptions,
  cache?: SectionLayoutCache,
) {
  const templates = new TemplateSectionRenderer(geometry, resources);
  const engine = new DocumentEngine(
    {
      editor: new EditorSectionRenderer(geometry, model, resources, cache),
      template: templates,
    },
    options,
    (page, { label, section }) => {
      const layout = sectionGeometry(geometry, section.options);
      const group =
        section.numbering === "roman"
          ? "introduction"
          : section.numbering === "appendix"
            ? "appendix"
            : "chapters";
      if (label)
        page.element.append(
          paginationPageNumber(
            label,
            layout,
            0,
            layout.pageNumber ?? layout.pageNumbers[group],
          ),
        );
    },
  );
  return engine;
}
