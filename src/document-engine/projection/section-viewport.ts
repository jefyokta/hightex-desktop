import { freezeReadOnlyPresentation } from "@/editor/pagination/presentation/read-only-content";

export interface SectionViewportGeometry {
  readonly width: number;
  readonly height: number;
  readonly stride: number;
}

/** Display recorded pages of one resolved section without replanning or copying per page. */
export class SectionViewport {
  readonly element: HTMLElement;
  readonly context: HTMLElement;
  readonly geometry: Readonly<SectionViewportGeometry>;
  private disposed = false;

  constructor(
    source: HTMLElement,
    geometry: SectionViewportGeometry,
    readonly pages: number,
  ) {
    if (
      !Number.isInteger(pages) ||
      pages < 1 ||
      ![geometry.width, geometry.height, geometry.stride].every(
        (value) => Number.isFinite(value) && value > 0,
      ) ||
      geometry.stride < geometry.height
    )
      throw new RangeError("Invalid section viewport geometry or page count");
    this.geometry = Object.freeze({
      width: geometry.width,
      height: geometry.height,
      stride: geometry.stride,
    });
    const document = source.ownerDocument;
    this.element = document.createElement("div");
    this.element.dataset.sectionViewport = "";
    this.element.style.cssText = `position:absolute;left:-100000px;top:0;width:${geometry.width}px;height:${geometry.height}px;overflow:hidden`;
    this.context = source.cloneNode(true) as HTMLElement;
    this.context.dataset.sectionContext = "";
    Object.assign(this.context.style, {
      position: "absolute",
      left: "0",
      top: "0",
      margin: "0",
      transform: "none",
      zoom: "1",
      height: `${pages * geometry.stride}px`,
      overflow: "visible",
    });
    try {
      const content = this.context.querySelector<HTMLElement>(".tiptap");
      const original = source.querySelector<HTMLElement>(".tiptap");
      if (!content || !original)
        throw Error("Missing resolved section content");
      freezeReadOnlyPresentation(content, original);
      // Read wrapping from the resolved source before mounting its copy. This
      // avoids a second complete style/layout pass solely to serialize HTML.
      this.context
        .querySelectorAll(
          "[data-editor-ui],img.ProseMirror-separator,.editor-pagination-sheets > :not(.editor-pagination-furniture)",
        )
        .forEach((node) => node.remove());
      this.element.append(this.context);
      document.body.append(this.element);
    } catch (error) {
      this.dispose();
      throw error;
    }
  }

  select(page: number) {
    if (this.disposed) throw Error("Section viewport is disposed");
    if (!Number.isInteger(page) || page < 1 || page > this.pages)
      throw new RangeError(
        "Section viewport page is outside its recorded result",
      );
    this.context.style.top = `${-(page - 1) * this.geometry.stride}px`;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.element.remove();
  }
}
