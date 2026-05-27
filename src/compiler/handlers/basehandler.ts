import "katex/dist/katex.min.css";
import { Handler, Chunker, Polisher } from "pagedjs";

import AttachmentHandler from "./attachment-handler";
import HeadingHandler from "./heading-handler";
import LinkHandler from "./link-handler";
import ListItem from "./list-item";
import PreventImageOverflow from "./prevent-image-overflow";
import RecountPage from "./recount-page";
import RepeatTableHeaderAndCaption from "./splitted-table-handler";
import ChapterListener from "./chapter-listener";
import Page from "@/types/pagedjs/chunker/page";
import BreakToken from "@/types/pagedjs/chunker/breaktoken";
import Layout from "@/types/pagedjs/chunker/layout";

export default class BaseHandler extends Handler {
  private figureTable = new RepeatTableHeaderAndCaption();
  private link = new LinkHandler();
  private list = new ListItem();
  private heading = new HeadingHandler();
  private chapteListener = new ChapterListener();
  private att = new AttachmentHandler();
  private recount = new RecountPage();
  private image = new PreventImageOverflow();

  private wm?: string;
  private picture?: HTMLImageElement;

  constructor(chunker: Chunker, polisher: Polisher, caller: any) {
    super(chunker, polisher, caller);

    this.wm =
      document
        .querySelector("meta[name='watermark']")
        ?.getAttribute("content") ?? undefined;

    const picture = document
      .querySelector("meta[name='picture']")
      ?.getAttribute("content");

    if (this.wm && picture) {
      const base = document.body.getAttribute("data-base-url") || "/";

      this.picture = new Image();
      this.picture.src = base.replace(/\/$/, "") + picture;

      this.picture.style.objectFit = "cover";
      this.picture.style.width = "100%";
      this.picture.style.height = "100%";
    }
  }

  afterPageLayout(
    pageElement: HTMLElement,
    page: Page,
    breakToken: BreakToken,
  ): void {
    this.chapteListener.afterPageLayout(pageElement, page, breakToken);
    this.list.afterPageLayout(pageElement, page, breakToken);
    this.image.afterPageLayout(pageElement, page, breakToken);
    this.figureTable.afterPageLayout(pageElement, page, breakToken);
    this.link.afterPageLayout(pageElement, page, breakToken);
    this.att.afterPageLayout(pageElement, page, breakToken);
  }

  onPageLayout(
    wrapper: HTMLElement,
    breakToken: BreakToken,
    layout: Layout,
  ): void {
    this.figureTable.onPageLayout(wrapper, breakToken, layout);
    this.image.onPageLayout(wrapper, breakToken, layout);
  }

  beforePageLayout(page: Page, _breakToken?: BreakToken): void {
    this.figureTable.handleFigureTableBeforePageLayout(page);
  }

  afterRendered(page: Page[], chunk: Chunker): void {
    this.heading.afterRendered(page, chunk);
    this.recount.afterRendered();
    this.att.afterRendered();
    this.chapteListener.afterRendered();

    // document.querySelectorAll(".spacer").forEach((e) => e.remove());

    this.injectWatermark();

    // document.dispatchEvent(new CustomEvent("page:rendered"));
    // (window as any).hightex = true;
  }

  beforePreview(): void {
    // document.dispatchEvent(new CustomEvent("page:start"));
  }

  beforeParsed(_f: HTMLElement): void {
    this.link.beforeParsed();
  }

  afterParsed(): void {}

  private injectWatermark(): void {
    if (!this.wm || !this.picture) return;

    const target = document.querySelector(
      ".cover-author",
    ) as HTMLElement | null;
    if (!target) return;

    const cover = target.closest(".pagedjs_sheet") as HTMLElement | null;
    if (!cover) return;

    const rect = target.getBoundingClientRect();
    const paperWidth = cover.getBoundingClientRect().width;

    const div = document.createElement("div");
    div.style.height = "4cm";
    div.style.width = "3cm";
    div.style.position = "absolute";
    div.style.top = "365px";
    div.style.overflow = "hidden";

    const minLeft = 0;
    const maxLeft = 179.836;

    let actualLeft = paperWidth / 2 - rect.width;
    actualLeft = Math.max(minLeft, Math.min(maxLeft, actualLeft));

    div.style.left = `${actualLeft}px`;
    div.classList.add("pimage");

    div.appendChild(this.picture);

    cover.appendChild(div);
  }
}
