/** Prototype only: retain canonical contexts and print the document on uniform work sheets. */
export function singlePassPrint(root: HTMLElement, snapshot: EditorPDFSnapshot) {
  const width = Math.max(...snapshot.projection.contexts.map(context => context.width));
  const stride = Math.max(...snapshot.projection.contexts.map(context => context.stride));
  const contexts = new Map<number, HTMLElement>(Array.from(root.querySelectorAll<HTMLElement>('[data-print-context]'),
    node => [Number(node.dataset.printContext), node] as [number, HTMLElement]));
  const chrome = Array.from(root.querySelectorAll<HTMLElement>('[data-page-chrome]'))
    .sort((left, right) => Number(left.dataset.pageChrome) - Number(right.dataset.pageChrome));
  const surface = document.createElement('main');
  surface.dataset.singlePassPrint = '';
  surface.style.cssText = `position:relative;width:${width}px;height:${snapshot.pages * stride}px`;
  const placed = new Set<number>();
  snapshot.projection.views.forEach((view, index) => {
    const geometry = snapshot.projection.contexts[view.context];
    if (!placed.has(view.context)) {
      if (geometry.pages > 1 && geometry.stride !== stride)
        throw Error('Prototype requires uniform editable stride');
      const holder = contexts.get(view.context)!;
      holder.style.position = 'absolute';
      holder.style.top = `${index * stride - (view.page - 1) * geometry.stride}px`;
      holder.style.left = '0';
      surface.append(holder);
      placed.add(view.context);
    }
    const overlay = chrome[index];
    overlay.style.cssText = `position:absolute;left:0;top:${index * stride}px;width:${width}px;height:${geometry.height}px`;
    surface.append(overlay);
  });
  root.querySelector('[data-print-viewport]')?.remove();
  root.append(surface);
  const style = document.createElement('style');
  style.textContent = `
    @page{size:${width}px ${stride}px;margin:0}
    html,body{margin:0!important;padding:0!important;background:white!important}
    [data-single-pass-print]{margin:0;padding:0;font:12pt/1.5 "Times New Roman",serif;background:white;color:black}
    [data-single-pass-print] *{break-before:auto!important;break-after:auto!important;break-inside:auto!important;orphans:1!important;widows:1!important}
    [data-context-bank],[data-chrome-bank]{display:none!important}
  `;
  document.head.append(style);
  return {width,stride,pages:snapshot.pages};
}
