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
import { CompilerError } from "@/exception/compiler-error";
import { LayoutError } from "@/exception/layout-error";

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
  waterMark?: boolean;
};

export class Engine {
  private finishCallback: (engine: Engine) => any = () => {};

  public root!: HTMLElement;
  private isInteractive = false;

  public readonly db = HighTexDB.getInstance();

  public config!: EngineConfig;

  private pipeline: EnginePipeline;
  public error: Error | null = null;
  private document: Window["document"];

  constructor() {
    this.pipeline = new EnginePipeline(this);

    this.document = this.isInFrame() ? window.parent.document : document;
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
      throw new CompilerError("Engine root not mounted");
    }

    if (!this.config?.parser) {
      throw new CompilerError("Parser config not initialized");
    }

    this.error = null;
    await this.pipeline.run();

    return this;
  }

  private interceptError() {
    const originalError = console.error;
    console.error = (...args) => {
      const [msg, node] = args;

      if (typeof msg === "string" && msg.includes("Layout repeated")) {
        console.log(" Paged.js overflow detected!", {
          message: msg,
          node,
        });
        if (this.isInFrame()) {
          FrameManager.sendMessage("layout:error", { node: undefined });
        } else {
          this.error = new LayoutError();
        }
      }

      originalError(...args);
    };

    return () => {
      console.error = originalError;
    };
  }

  private async assignWatermark() {
    const pages = Array.from(
      document.querySelectorAll<HTMLDivElement>(".pagedjs_pagebox"),
    );

    const images = pages.map((page) => {
      page.style.position = "relative";

      const img = document.createElement("img");
      img.src = "/wm-uin.jpg";

      img.style.position = "absolute";
      img.style.inset = "0";
      img.style.width = "100%";
      img.style.height = "100%";
      img.style.objectFit = "cover";
      img.style.pointerEvents = "none";
      img.style.userSelect = "none";
      img.style.zIndex = "0";
      img.draggable = false;

      page.prepend(img);

      return img;
    });

    await Promise.all(
      images.map((img) => {
        if (img.complete && img.naturalWidth > 0) {
          return Promise.resolve();
        }

        return new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () =>
            reject(new Error("Watermark image failed to load"));
        });
      }),
    );

    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  }

  async createPaged() {
    const cleanup = this.interceptError();
    this.error = null;
    let shadowHost: HTMLElement | null = null;
    try {
      if (!this.root) throw new Error("Engine root not mounted");

      const content = this.config.paged?.content;
      const renderTo = this.config.paged?.renderTo;
      if (!content || !renderTo) return;

      shadowHost = document.createElement("div");
      shadowHost.classList.add("no-print");
      shadowHost.style.cssText = "position:absolute;left:-99999px;top:0;";
      document.body.appendChild(shadowHost);

      const wrapper = document.createElement("div");
      wrapper.innerHTML = content.innerHTML;
      const fragment = document.createDocumentFragment();
      fragment.append(wrapper);

      await this.document.fonts.ready;

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

      cleanup();

      if (this.error) {
        throw this.error;
      }
      if (this.config.waterMark) {
        await this.assignWatermark();
      }

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
    } finally {
      cleanup();
      shadowHost?.remove();
    }
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
      hasWm: this.config.waterMark,
      keywords: this.parser.document
        .getDocument()
        .keywords.indonesian.map((k) => k.replace("_", "")),
      detail: ChapterListener.instance.detail,
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
