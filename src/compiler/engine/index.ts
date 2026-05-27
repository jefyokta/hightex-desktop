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
        biblio?: HTMLElement;
        abstractEn?: HTMLElement;
        abstractId?: HTMLElement;
        foreword?: HTMLElement;
        presentation?: HTMLElement;
      };

export type EngineConfig = {
  parser: ParserContext;
  paged?: {
    content?: HTMLElement;
    renderTo?: HTMLElement;
  };
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
    await this.pipeline.run().catch(console.log);

    return this;
  }

  async createPaged() {
    if (!this.root) throw new Error("Engine root not mounted");

    const content = this.config.paged?.content;
    const renderTo = this.config.paged?.renderTo;
    if (!content || !renderTo) return;

    const shadowHost = document.createElement("div");
    shadowHost.style.cssText = "position:absolute;left:-99999px;top:0;";
    document.body.appendChild(shadowHost);

    const wrapper = document.createElement("div");
    wrapper.innerHTML = content.innerHTML;

    let cssText = "";
    Array.from(document.styleSheets).forEach((sheet) => {
      try {
        Array.from(sheet.cssRules).forEach((r) => {
          cssText += r.cssText + "\n";
        });
      } catch {}
    });
    const fragment = document.createDocumentFragment();

    fragment.append(wrapper);

    const styleEl = document.createElement("style");
    styleEl.textContent = cssText;

    const chunker = await new Paged.Previewer({ auto: false })
      .preview(fragment, undefined, renderTo)
      .then((c) => {
        new PageNumberResolver().resolve();
        this.root.remove();
        TOFBuilder.assignPageNumbers();
        TocBuilder.assignPageNumbers();
        return c;
      });
    const shouldInteractive = window.inFrame ? true : false;
    if (shouldInteractive) await new Interactable().resolve(this);
    await this.finishCallback(this);
    document.dispatchEvent(
      new CustomEvent("page:rendered", { detail: { engine: this } }),
    );

    FrameManager.sendMessage("page:rendered", { totalPages: chunker.total });
 
    this.dispathToMainProcess();
    return chunker;
  }

  destroy() {
    this.finishCallback = () => {};
  }

  private dispathToMainProcess() {
    if (this.parser.mode == "single" || window.inFrame) {
      return;
    }

    const stack = ChapterListener.instance.stack;
    const payload: ExportPayload = {
      chapters: stack,
      title: this.parser.document.getDocument().title,
    };

    (window as any).__hightexExportPayload = payload;

    try {
      window.ipcRenderer.send(`page:payload:${this.parser.document.id}`, payload);
    } catch (error) {
      console.error("Unable to send export payload to main process", error);
    }
  }
}
