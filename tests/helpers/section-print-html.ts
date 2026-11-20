import { SectionViewport } from "../../src/document-engine/projection/section-viewport";
import { DocumentResources } from "../../src/document-engine/resources/document-resources";
import { waitForPrintImages } from "../../src/compiler/print-resources";
import { waitForContentFonts } from "../../src/document-engine/resources/fonts";

/** Portable print host input for the isolated projection proof. */
export async function sectionPrintHTML(viewport: SectionViewport, signal: AbortSignal, capturedStyles?: { readonly css: string; assertCurrent(): void }) {
  const resources = new DocumentResources(signal);
  for (const image of viewport.context.querySelectorAll("img")) image.src = await resources.data(image.src);
  await waitForPrintImages(viewport.context, signal);await waitForContentFonts(viewport.context, signal);
  const css = capturedStyles?.css ?? await resources.styles();signal.throwIfAborted();capturedStyles?.assertCurrent();
  const page = document.implementation.createHTMLDocument(), styles = page.createElement("style");
  const charset = page.createElement("meta");charset.setAttribute("charset", "utf-8");page.head.prepend(charset);
  styles.textContent = css + `
    @page { size:${viewport.geometry.width}px ${viewport.geometry.height}px; margin:0 }
    html,body { margin:0!important;padding:0!important;background:white!important }
    [data-section-context],[data-section-context] * {
      break-before:auto!important;break-after:auto!important;break-inside:auto!important;
      orphans:1!important;widows:1!important;
    }
  `;
  const root = viewport.element.cloneNode(true) as HTMLElement;
  root.style.position = "relative";root.style.left = "0";
  page.head.append(styles);page.body.append(root);page.documentElement.lang = "id";
  return "<!doctype html>" + page.documentElement.outerHTML;
}
