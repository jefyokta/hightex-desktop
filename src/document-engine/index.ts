import { TypedEmitter } from "@/event/typed-emitter";
import { abortable } from "@/utils/abortable";
import { DocumentEngineError } from "@/exception/document-engine-error";
import { DocumentIndex } from "./indexes/document-index";
import { numberDocument } from "./numbering";
import { resolveDocumentReferences } from "./references";
import { DocumentEngineRun } from "./run";
import { renderSection } from "./render-section";
import { mergeSectionOptions, sectionGroup } from "@/utils/section-options";
import type {
  DocumentEngineEvents,
  DocumentEngineOptions,
  DocumentSection,
  DocumentSectionSlot,
  DocumentPageDecorator,
  DocumentRenderResult,
  EngineRenderers,
  PageSection,
  RenderedDocumentSection,
  SectionOutline,
} from "@/types/document-engine";

export class DocumentEngine {
  private readonly emitter = new TypedEmitter<DocumentEngineEvents>();
  readonly events: Pick<
    TypedEmitter<DocumentEngineEvents>,
    "on" | "off" | "once"
  > = this.emitter;
  private slots: DocumentSectionSlot[] = [];
  private run?: DocumentEngineRun;
  private disposed = false;
  private disposeRequested = false;
  private rendering = false;
  private status: "idle" | "running" | "ready" | "failed" | "cancelled" =
    "idle";
  private metadata: PageSection[] = [];
  private readonly sectionOptions: DocumentEngineOptions["sections"];

  constructor(
    private readonly renderers: EngineRenderers,
    options: DocumentEngineOptions = {},
    private readonly decoratePage?: DocumentPageDecorator,
  ) {
    this.sectionOptions = structuredClone(options.sections);
  }

  get state() {
    return this.disposed ? "disposed" : this.status;
  }
  get sections(): readonly PageSection[] {
    return structuredClone(this.metadata);
  }
  get identity() {
    return this.completed().map(({ definition, rendered }) => ({
      id: definition.id,
      kind: definition.kind,
      options: definition.options,
      layout: rendered.identity,
    }));
  }
  get documentPages() {
    return this.completed().flatMap(({ rendered }) => [...rendered.pages]);
  }

  async render(
    target: HTMLElement,
    definitions: readonly DocumentSection[],
    documentId: string,
    signal: AbortSignal,
  ): Promise<DocumentRenderResult> {
    if (this.disposed || this.status !== "idle" || target.childNodes.length)
      throw Error(
        "Document engine requires an unused instance and empty target",
      );
    this.status = "running";
    this.rendering = true;
    const run = (this.run = new DocumentEngineRun(
      this.emitter,
      documentId,
      signal,
    ));
    try {
      if (!definitions.length) throw Error("Document contains no sections");
      this.slots = structuredClone(definitions).map((definition) => {
        definition.group = sectionGroup(definition);
        const override = this.sectionOptions?.[definition.group];
        if (override)
          definition.options = mergeSectionOptions(
            definition.options,
            override,
          );
        return { definition };
      });
      await run.hook("start", {
        sections: this.slots.length,
      });
      const ids = new Set<string>();
      for (const { definition } of this.slots) {
        if (ids.has(definition.id))
          throw Error(`Duplicate document section: ${definition.id}`);
        ids.add(definition.id);
      }
      const index = await this.renderContent(run);
      await this.renderIndexes(run, index);
      run.stage("references");
      const completed = this.completed(),
        numbered = numberDocument(completed);
      this.metadata = numbered.metadata;
      for (const error of resolveDocumentReferences(
        completed,
        numbered.targets,
        run.diagnostic,
      )) {
        await run.report(error);
      }
      await this.assemble(target, completed, run);
      const result = this.result(target.children.length, run.warnings);
      run.stage("rendered");
      this.status = "ready";
      run.outcome("rendered", result);
      return result;
    } catch (cause) {
      this.release();
      if (run.signal.aborted) {
        this.status = "cancelled";
        run.outcome("cancel", { reason: run.signal.reason });
        throw run.signal.reason;
      }
      this.status = "failed";
      const error =
        cause instanceof DocumentEngineError &&
        cause.diagnostic.runId === run.id
          ? cause
          : new DocumentEngineError(run.diagnostic, cause);
      run.diagnostic = { ...error.diagnostic };
      run.outcome("error", { error });
      throw error;
    } finally {
      this.rendering = false;
      run.detach();
      if (this.disposeRequested) this.dispose();
    }
  }

  private async renderContent(run: DocumentEngineRun) {
    const index = new DocumentIndex();
    let sections = 0,
      contentPages = 0;
    const outline: SectionOutline[] = [];
    for (const slot of this.slots) {
      if (slot.definition.kind === "template" && slot.definition.index)
        continue;
      slot.rendered = await renderSection(
        slot.definition,
        this.renderers,
        run,
        "content",
        0,
      );
      sections++;
      contentPages += slot.rendered.pages.length;
      index.collect(slot.rendered.outline);
      outline.push(...slot.rendered.outline);
    }
    run.stage("content");
    await run.hook("contentRendered", {
      sections,
      contentPages,
      outline: structuredClone(outline),
    });
    return index;
  }

  private async renderIndexes(
    run: DocumentEngineRun,
    index: DocumentIndex,
  ) {
    if (
      !this.slots.some(
        ({ definition }) => definition.kind === "template" && definition.index,
      )
    )
      return;
    for (let pass = 1; pass <= 4; pass++) {
      run.stage("index");
      const { targets } = numberDocument(this.slots),
        changed: string[] = [];
      for (const slot of this.slots) {
        if (slot.definition.kind !== "template" || !slot.definition.index)
          continue;
        const html = index.html(slot.definition, targets);
        if (slot.rendered && html === slot.definition.html) continue;
        const definition = { ...slot.definition, html };
        const replacement = await renderSection(
          definition,
          this.renderers,
          run,
          "index",
          pass,
        );
        slot.rendered?.destroy();
        slot.definition = definition;
        slot.rendered = replacement;
        changed.push(definition.id);
      }
      run.stage("index");
      await run.hook("index.pass", { pass, changed, stable: !changed.length });
      if (!changed.length) return;
    }
    throw Error("Document page references did not converge");
  }

  private async assemble(
    target: HTMLElement,
    sections: RenderedDocumentSection[],
    run: DocumentEngineRun,
  ) {
    run.stage("assembly");
    for (const { definition, rendered } of sections) {
      run.stage("assembly", definition);
      for (const page of rendered.pages) {
        run.signal.throwIfAborted();
        if (this.decoratePage)
          await abortable(
            Promise.resolve(
              this.decoratePage(page, {
                label: page.element.dataset.pageLabel ?? "",
                section: definition,
                signal: run.signal,
              }),
            ),
            run.signal,
          );
        run.signal.throwIfAborted();
        target.append(page.element);
      }
    }
    if (
      target.children.length !==
      this.metadata.reduce((sum, section) => sum + section.pages, 0)
    )
      throw Error("Document assembly changed the page count");
  }

  private result(pages: number, warnings: number): DocumentRenderResult {
    const sections = this.sections.map((section) => {
      Object.freeze(section.labels);
      return Object.freeze(section);
    });
    return Object.freeze({
      pages,
      warnings,
      sections: Object.freeze(sections),
    });
  }

  private completed(): RenderedDocumentSection[] {
    return this.slots.map((slot) => {
      if (!slot.rendered)
        throw Error(`Section has not been rendered: ${slot.definition.id}`);
      return { definition: slot.definition, rendered: slot.rendered };
    });
  }

  private release() {
    for (const section of this.slots.splice(0)) {
      try {
        section.rendered?.destroy();
      } catch (error) {
        console.error("Document engine cleanup failed", {
          runId: this.run?.id,
          sectionId: section.definition.id,
          error,
        });
      }
    }
    this.metadata = [];
  }

  destroy() {
    if (this.disposed || this.disposeRequested) return;
    this.disposeRequested = true;
    if (this.rendering) {
      if (this.status === "running") this.run?.cancel();
    } else this.dispose();
  }

  private dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.release();
    for (const renderer of new Set(Object.values(this.renderers))) {
      try {
        renderer.destroy?.();
      } catch (error) {
        console.error("Document engine renderer cleanup failed", error);
      }
    }
    if (this.run) this.run.dispose();
    else
      this.emitter.notify("dispose", { sequence: 1 }, (error) =>
        console.error("Document engine observer failed", {
          event: "dispose",
          error,
        }),
      );
    this.emitter.clear();
  }
}

export type {
  DocumentEngineEvents,
  DocumentEngineOptions,
  DocumentSection,
  EngineRenderers,
} from "@/types/document-engine";
