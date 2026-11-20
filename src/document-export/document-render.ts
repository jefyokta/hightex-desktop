import type { DocumentRenderModel } from "@/types/document-snapshot";
import type { PaginationGeometry } from "@/editor/pagination/options";
import type { SectionGroup, SectionOptions } from "@/types/pagination/section-options";
import type { DocumentResourceContext } from "@/document-engine/resources/contracts";
import type { DocumentEngineOptions } from "@/types/document-engine";
import { DocumentSections } from "@/document-engine/adapters/current-category";
import { createEditorDocumentEngine } from "@/document-engine/adapters/editor-document";
import type { DocumentEngine } from "@/document-engine";
import {
  mergeSectionGroups,
  mergeSectionOptions,
} from "@/utils/section-options";
import { documentLayoutCache } from "../editor/document/layout-cache";

/** Frozen inputs shared by document composition and page-number metadata. No live view ownership. */
export interface DocumentExportInput {
  data: HighTexDocument;
  model: DocumentRenderModel;
  category: Category;
  version?: string;
  baseGeometry: PaginationGeometry;
  sectionOptions?: DocumentEngineOptions["sections"];
  active?: { id: string; group: SectionGroup; options?: SectionOptions };
  resources: DocumentResourceContext;
  appearance: string;
  sourceHash: string;
}

/** One document render lifecycle shared by export and editor page-number metadata. */
export class DocumentRenderSession {
  readonly output = document.createElement("main");
  private parts?: DocumentSections;
  private engine?: DocumentEngine;
  private disposed = false;

  constructor(readonly input: DocumentExportInput) {
    this.output.className = "editor-pdf-pages";
    this.output.style.cssText = "position:absolute;left:-100000px;top:0";
    document.body.append(this.output);
  }

  async render(
    signal: AbortSignal,
    options: DocumentEngineOptions = {},
    hooks?: (engine: DocumentEngine) => void,
  ) {
    if (this.disposed || this.engine)
      throw Error("Document rendering is single-use");
    const input = this.input;
    this.parts = new DocumentSections({
      document: input.data,
      category: input.category,
      model: input.model,
      version: input.version,
    });
    this.engine = createEditorDocumentEngine(
      input.baseGeometry,
      this.parts.model,
      input.resources,
      { sections: this.sectionPolicies(options) },
      documentLayoutCache(),
    );
    hooks?.(this.engine);
    await this.engine.render(
      this.output,
      this.parts.sections,
      input.data.id,
      signal,
    );
    return this.engine;
  }

  private sectionPolicies(options: DocumentEngineOptions) {
    const input = this.input;
    const policies = mergeSectionGroups(input.sectionOptions);
    if (input.active?.options) {
      const group = input.active.group;
      policies[group] = mergeSectionOptions(
        policies[group],
        input.active.options,
      );
    }
    return mergeSectionGroups(policies, options.sections);
  }

  destroy() {
    if (this.disposed) return;
    this.disposed = true;
    this.engine?.destroy();
    this.parts?.destroy();
    this.output.remove();
  }
}
