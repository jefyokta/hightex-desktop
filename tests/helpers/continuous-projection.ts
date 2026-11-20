import type { EditorView } from "@tiptap/pm/view";
import type { PaginationGeometry } from "../../src/editor/pagination/options";
import { freezeReadOnlyPresentation } from "../../src/editor/pagination/presentation/read-only-content";
import { DocumentResources } from "../../src/document-engine/resources/document-resources";
import { waitForPrintImages } from "../../src/compiler/print-resources";
import { waitForContentFonts } from "../../src/document-engine/resources/fonts";

/** One context for the entire section. Native stride slicing is an unproven host adapter. */
export class ContinuousProjection {
  readonly output: HTMLElement;

  constructor(view: EditorView, readonly geometry: PaginationGeometry, readonly pages: number) {
    const source = view.dom.closest<HTMLElement>(".page");
    if (!source) throw Error("Missing canonical section surface");
    this.output = source.cloneNode(true) as HTMLElement;
    this.output.dataset.continuousProjection = "";
    Object.assign(this.output.style, {
      position: "relative", left: "0", top: "0", margin: "0", transform: "none", zoom: "1",
      height: `${pages * geometry.stride}px`, overflow: "visible",
    });
    this.output.querySelectorAll('[data-editor-ui],img.ProseMirror-separator,.editor-pagination-sheets > :not(.editor-pagination-furniture)').forEach(node => node.remove());
    const content = this.output.querySelector<HTMLElement>(".tiptap");
    if (!content) throw Error("Missing canonical content");
    freezeReadOnlyPresentation(content);
  }

  async html(signal: AbortSignal) {
    const resources = new DocumentResources(signal);
    for (const image of this.output.querySelectorAll("img")) image.src = await resources.data(image.src);
    await waitForPrintImages(this.output, signal);
    await waitForContentFonts(this.output, signal);
    const styles = await resources.styles();
    signal.throwIfAborted();
    const page = document.implementation.createHTMLDocument();
    page.documentElement.lang = "id";
    const charset = page.createElement("meta");charset.setAttribute("charset", "utf-8");page.head.prepend(charset);
    const css = page.createElement("style");
    css.textContent = styles + `
      @page { size: ${this.geometry.width}px ${this.geometry.stride}px; margin: 0 }
      html,body { margin:0!important; padding:0!important; background:white!important }
      [data-continuous-projection] { margin:0!important; break-after:auto!important }
      [data-continuous-projection], [data-continuous-projection] * {
        break-before:auto!important; break-after:auto!important; break-inside:auto!important;
        orphans:1!important; widows:1!important;
      }
    `;
    page.head.append(css);
    const context = this.output.cloneNode(true) as HTMLElement;
    page.body.append(context);
    return "<!doctype html>" + page.documentElement.outerHTML;
  }

  destroy() { this.output.remove(); }
}
