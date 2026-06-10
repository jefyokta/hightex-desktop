import * as Paged from "pagedjs";
import { HighTexDB } from "@/editor/storage/hightex-db";
import { EnginePipeline } from "./engine-pipeline";
import { Document } from "@/editor/document";
import { Chapter } from "@/editor/chapter";
import { Interactable } from "../resolver/interactable-resolver";
import { FrameManager } from "@/frame/manager";
import { TocBuilder } from "../builder/toc-builder";
import { PageNumberResolver } from "../resolver/page-number-resolver";
import { TOFBuilder } from "../builder/tof-builder";
import ChapterListener from "../handlers/chapter-listener";
import { ImageQueue } from "../queues/image-queue";

type EngineMode = "single" | "full";

export type ParserContext<T extends EngineMode = EngineMode> =
  T extends "single"
    ? {
        mode: "single";
        chapter: Chapter;
      }
    : {
        mode: "full";
        document: Document;
      };

export type EngineConfig = {
  parser: ParserContext;
  paged?: {
    content?: HTMLElement;
    renderTo?: HTMLElement;
  };
  profile?: DocumentProfile;
};

export class Engine {
  private finishCallback: (engine: Engine) => any = () => {};

  public root!: HTMLElement;
  private isInteractive = false;

  public readonly db = HighTexDB.getInstance();

  public config!: EngineConfig;

  private pipeline: EnginePipeline;

  constructor() {
    this.pipeline = new EnginePipeline(this);
  }

  static getInstance() {
    return new Engine();
  }

  withParser(parser: ParserContext) {
    this.config = {
      ...this.config,
      parser,
    };

    return this;
  }

  withConfig(config: Partial<EngineConfig>) {
    this.config = {
      ...this.config,
      ...config,
    } as EngineConfig;

    return this;
  }
  interactable(value = true) {
    this.isInteractive = value;
    console.log(this.isInteractive, "mwhehehe mamam eslint");

    return this;
  }

  mount(root: HTMLElement) {
    this.root = root;
    return this;
  }

  whenPagesCreated(callback: (engine: Engine) => any) {
    this.finishCallback = callback;
    return this;
  }

  get parser() {
    if (!this.config?.parser) {
      throw new Error("Parser context not initialized");
    }

    return this.config.parser;
  }

  async run() {
    if (!this.root) {
      throw new Error("Engine root not mounted");
    }

    if (!this.config?.parser) {
      throw new Error("Parser config not initialized");
    }
    console.log("memeks");

    await this.pipeline.run().catch(console.log);

    return this;
  }

  async createPaged() {
    console.log("creating pages..");
    if (!this.root) throw new Error("Engine root not mounted");

    const content = this.config.paged?.content;
    const renderTo = this.config.paged?.renderTo;
    if (!content || !renderTo) return;

    const shadowHost = document.createElement("div");
    shadowHost.style.cssText = "position:absolute;left:-99999px;top:0;";
    document.body.appendChild(shadowHost);

    const wrapper = document.createElement("div");
    wrapper.innerHTML = content.innerHTML;
    const fragment = document.createDocumentFragment();
    fragment.append(wrapper);
    const chunker = await new Paged.Previewer({ auto: false })
      .preview(fragment, undefined, renderTo)
      .then(async (c) => {
        new PageNumberResolver().resolve();
        this.root.remove();
        if (this.parser.mode == "full") {
          TOFBuilder.assignPageNumbers();
          await TocBuilder.assignPageNumbers();
        }
        return c;
      });
    if (this.isInFrame()) await new Interactable().resolve(this);
    await this.finishCallback(this);
    document.dispatchEvent(
      new CustomEvent("page:rendered", { detail: { engine: this } }),
    );

    FrameManager.sendMessage("page:rendered", { totalPages: chunker.total });

    this.dispathToMainProcess();
    for (const obj of ImageQueue.objectUrls) {
      URL.revokeObjectURL(obj);
    }
    return chunker;
  }

  destroy() {
    this.finishCallback = () => {};
  }
  isInFrame() {
    return window.parent && window.parent !== window;
  }

  private dispathToMainProcess() {
    if (this.parser.mode == "single" || this.isInFrame()) {
      return;
    }

    const stack = ChapterListener.instance.stack;
    const payload: ExportPayload = {
      chapters: stack,
      title: this.parser.document.getDocument().title,
      author: this.config.profile?.name,
      keywords: this.parser.document
        .getDocument()
        .keywords.indonesian.map((k) => k.replace("_", "")),
    };

    (window as any).__hightexExportPayload = payload;

    try {
      window.ipcRenderer.send(
        `page:payload:${this.parser.document.id}`,
        payload,
      );
    } catch (error) {
      console.error("Unable to send export payload to main process", error);
    }
  }
}
