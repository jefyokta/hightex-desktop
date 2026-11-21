import { waitForPrintImages } from '../../src/compiler/print-resources';

/** Prototype: put the existing viewport of each batch on its own named native page. */
export async function namedBatchPrint(
  root: HTMLElement,
  fingerprint: string,
  batches: readonly { index: number; count: number; geometry: {width:number;height:number;stride:number} }[],
) {
  const rules: string[] = [];
  const pages: HTMLElement[] = [];
  const sizes: {width: number; height: number}[] = [];
  for (const [index, batch] of batches.entries()) {
    window.editorPDFViewport!.select(batch.index, fingerprint, batch.count);
    const viewport = root.querySelector<HTMLElement>('[data-print-viewport]')!;
    const copy = viewport.cloneNode(true) as HTMLElement;
    // An atomic inline viewport owns its overflowing context on this native sheet.
    copy.style.display = 'inline-block';
    copy.style.verticalAlign = 'top';
    const page = document.createElement('section');
    page.style.cssText = `page:htxBatch${index};break-after:page;margin:0;padding:0;font-size:0;line-height:0`;
    page.append(copy);
    pages.push(page);
    const width = batch.geometry.width;
    const height = (batch.count - 1) * batch.geometry.stride + batch.geometry.height;
    sizes.push({width,height});
    rules.push(`@page htxBatch${index}{size:${width}px ${height}px;margin:0}`);
  }
  root.replaceChildren(...pages);
  const style = document.createElement('style');
  style.textContent = rules.join('\n');
  document.head.append(style);
  await waitForPrintImages(root,new AbortController().signal);
  await document.fonts.ready;
  return {sizes,nodes:root.querySelectorAll('*').length};
}
