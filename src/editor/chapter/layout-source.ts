import type { Chapter } from "./chapter";
import type { Node as ModelNode } from "@tiptap/pm/model";
import type { DocumentRenderModel } from "@/types/document-snapshot";
import { TypedEmitter } from "@/event/typed-emitter";
import { observeDocumentSources } from "../storage/document-source-observer";
import { readDocumentRenderSnapshot } from "../storage/document-render-snapshot";
import { documentRenderModel } from "../document/render-model";
import { documentSnapshotModel } from "../document/snapshot-model";
import { Document } from "../document";
import { ChapterImageResources } from "./image-resources";
import { DocumentResources } from "../../document-engine/resources/document-resources";
import { abortable } from "@/utils/abortable";
import type { LayoutInvalidationReason } from "@/document-engine/layout/layout-session";
import { chapterRenderContext } from "./render-context";
import { documentSourceTargets } from "@/document-engine/projection/source-map";
import { chapterLayoutResources } from "./layout-dependencies";

type ResolvedSource = {
  model: DocumentRenderModel;
  images: ChapterImageResources;
};

/** Application data/resource port. Keystrokes use the buffer; IDB reads do not touch editing state. */
export class EditorLayoutSource {
  private readonly emitter = new TypedEmitter<{
    changed: { reason: LayoutInvalidationReason };
  }>();
  readonly events: Pick<typeof this.emitter, "on" | "off"> = this.emitter;
  private chapter?: Chapter;
  private lifecycle?: AbortController;
  private revision?: AbortController;
  private observer?: ReturnType<typeof observeDocumentSources>;
  private model?: Promise<ResolvedSource>;
  private images?: ChapterImageResources;
  private resources?: DocumentResources;
  private presentation?: Promise<string>;
  private buffer?: ModelNode;
  private graphs = new WeakMap<
    DocumentRenderModel["chapters"][number],
    { documentId: string; graph: ChapterGraphData }
  >();
  private theme: MutationObserver;

  constructor() {
    this.theme = new MutationObserver(() => this.presentationChanged());
    this.theme.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
  }

  update(chapter: Chapter | undefined, buffer?: ModelNode): boolean {
    this.buffer = buffer;
    if (this.chapter === chapter) return false;
    this.stop();
    this.chapter = chapter;
    if (!chapter) return true;
    this.lifecycle = new AbortController();
    this.resources = new DocumentResources(this.lifecycle.signal);
    this.observer = observeDocumentSources(
      [chapter.getDocumentId()],
      () => {
        this.revision?.abort();
        this.model = undefined;
        this.images?.dispose();
        this.images = undefined;
        this.changed("resources");
      },
      this.lifecycle.signal,
      {
        chapterBuffer: {
          id: chapter.getId(),
          content: () => this.buffer?.toJSON().content,
        },
      },
    );
    void this.observer.ready.catch(() => {});
    return true;
  }

  get ready() {
    return this.observer?.ready ?? Promise.resolve();
  }

  presentationChanged() {
    this.presentation = undefined;
    if (this.chapter) this.changed("presentation");
  }

  private changed(reason: LayoutInvalidationReason) {
    this.emitter.notify("changed", { reason }, (error) =>
      console.error("Layout source observer failed", error),
    );
  }

  async read(buffer: ModelNode, signal: AbortSignal) {
    const chapter = this.chapter;
    if (!chapter || !this.resources)
      throw Error("Chapter layout source is not ready");
    if (!this.model) {
      const revision = new AbortController();
      this.revision = revision;
      this.model = (async () => {
        await abortable(this.ready, revision.signal);
        const snapshot = await readDocumentRenderSnapshot(
          chapter.getDocumentId(),
          revision.signal,
        );
        if (!chapter.document.category)
          throw Error(`Chapter ${chapter.getId()} has no document category`);
        const model = documentSnapshotModel(
          Document.fromSnapshot(
            snapshot.document,
            chapter.document.category,
            chapter.getVersion() ?? undefined,
          ),
          await documentRenderModel(snapshot),
        );
        revision.signal.throwIfAborted();
        const images = (this.images = new ChapterImageResources(model.images));
        return { model, images };
      })();
    }
    this.presentation ??= this.resources.layoutFingerprint();
    const [source, presentationHash] = await abortable(
      Promise.all([this.model, this.presentation]),
      signal,
    );
    const model = {
      ...source.model,
      chapters: source.model.chapters.map((item) =>
        item.id === chapter.getChapter()
          ? { ...item, content: buffer.toJSON().content ?? [] }
          : item,
      ),
    };
    const context = chapterRenderContext(model, this.graphs);
    const sourceTargets = documentSourceTargets(
      model.chapters.map((item) => ({
        id: `${model.document.id}.${item.id}`,
        content: item.content,
      })),
    );
    const resourcesHash = await abortable(
      chapterLayoutResources(
        buffer,
        model,
        context,
        sourceTargets,
        source.images,
      ),
      signal,
    );
    return {
      ...source,
      model,
      presentationHash,
      context,
      sourceTargets,
      resourcesHash,
    };
  }

  private stop() {
    this.lifecycle?.abort();
    this.revision?.abort();
    this.images?.dispose();
    this.images = undefined;
    this.model = undefined;
    this.presentation = undefined;
    this.resources = undefined;
    this.graphs = new WeakMap();
    this.observer = undefined;
    this.chapter = undefined;
  }

  dispose() {
    this.stop();
    this.theme.disconnect();
    this.emitter.clear();
  }
}
