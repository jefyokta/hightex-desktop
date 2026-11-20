const assert = require("node:assert/strict");
const path = require("node:path");
const { writeFileSync } = require("node:fs");
const { PDFDocument, PDFName, PDFArray, PDFDict } = require("pdf-lib");
const { auditSurface, verdict } = require("./editor-pagination-compare.cjs");

exports.materialize = async ({ execute, contract, folder }) => {
  const output = await execute(`
    const {PageFragments}=await import('/tests/helpers/legacy-pagination/fragments.ts');
    const {fragmentText}=await import('/tests/helpers/legacy-pagination/fragment-content.ts');
    window.fragmentHost=document.createElement('div');fragmentHost.style.cssText='position:absolute;left:2400px;top:0';document.body.append(fragmentHost);
    window.pageFragments=new PageFragments(readOnlyPlan,planGeometry);
    await pageFragments.render(fragmentHost,new AbortController().signal);
    const pages=pageFragments.pages.map(page=>({page:page.page,ranges:page.ranges.map(range=>({block:range.block,from:range.from,to:range.to,size:range.slice.size,text:fragmentText(readOnlyPlan.view,range.from,range.to)}))}));
    const ids=Array.from(fragmentHost.querySelectorAll('[id]'),node=>node.id);
    const targets=Array.from(pageFragments.targets.entries());
    const links=Array.from(fragmentHost.querySelectorAll('a[href^="#"]'),link=>{
      const id=decodeURIComponent(link.getAttribute('href').slice(1));
      return {id,page:pageFragments.targets.get(id),count:fragmentHost.querySelectorAll('#'+CSS.escape(id)).length};
    });
    const targetId=links[0]?.id;let sourceTargetPage;
    planDoc.descendants((node,pos)=>{if(node.attrs.id===targetId)sourceTargetPage=Math.floor((readOnlyPlan.view.nodeDOM(pos).getBoundingClientRect().top-planHost.getBoundingClientRect().top)/planGeometry.stride)+1});
    const text=pageFragments.pages.map(page=>page.content.textContent).join('');
    const ordered=pageFragments.pages.flatMap(page=>page.ranges).sort((a,b)=>a.from-b.from);
    const restored=ordered.map(range=>planDoc.textBetween(range.from,range.to,'','')).join('');
    const resolved=pageFragments.pages.flatMap(page=>page.ranges).map(range=>fragmentText(readOnlyPlan.view,range.from,range.to)).join('');
    const sourcePaper=planHost.getBoundingClientRect();
    const cells=pageFragments.pages.flatMap(page=>Array.from(page.content.querySelectorAll('[data-fragment-cell]'),cell=>{
      const from=Number(cell.dataset.fragmentCell),source=readOnlyPlan.view.nodeDOM(from),expected=source.getBoundingClientRect(),actual=cell.getBoundingClientRect(),paper=page.element.getBoundingClientRect();
      return {from,page:page.page,colspan:cell.colSpan,rowspan:cell.rowSpan,sourceRowspan:source.rowSpan,column:Number(cell.dataset.fragmentColumn),left:actual.left-paper.left,width:actual.width,expectedLeft:expected.left-sourcePaper.left,expectedWidth:expected.width};
    }));
    const result=document.createElement('main');
    for(const page of pageFragments.pages){
      const sheet=document.createElement('section');sheet.className='proof-sheet';
      const copy=page.element.cloneNode(true);copy.style.margin='0';sheet.append(copy);result.append(sheet);
    }
    return {html:result.innerHTML,pages,ids,targets,links,sourceTargetPage,cells,
      textIntact:restored===planDoc.textContent&&text===resolved,
      sourceTextLength:planDoc.textContent.length,resolvedTextLength:resolved.length,renderedTextLength:text.length,
      imageCount:readOnlyPlan.view.dom.querySelectorAll('img:not(.ProseMirror-separator)').length,
      geometry:planGeometry,
      sourceElements:readOnlyPlan.view.dom.querySelectorAll('*').length,renderedElements:fragmentHost.querySelectorAll('*').length,
      plan:recordedPlan};
  `);
  assert.equal(output.textIntact, true);
  for (const cell of output.cells) {
    assert.ok(
      Math.abs(cell.left - cell.expectedLeft) < 1,
      `Fragment cell moved to another column: ${cell.from} page ${cell.page}`,
    );
    assert.ok(
      Math.abs(cell.width - cell.expectedWidth) < 1,
      `Fragment cell width changed: ${cell.from} page ${cell.page}`,
    );
    assert.ok(cell.rowspan >= 1 && cell.rowspan <= cell.sourceRowspan);
  }
  if (process.env.HIGHTEX_PAGE_PLAN_MERGED) {
    assert.ok(output.cells.some((cell) => cell.colspan > 1));
    assert.ok(
      output.cells.some(
        (cell) =>
          cell.sourceRowspan > 1 &&
          output.cells.some(
            (other) => other.from === cell.from && other.page !== cell.page,
          ),
      ),
      "Fixture never continued a merged cell across pages",
    );
  }
  assert.ok(
    output.renderedElements < output.sourceElements * output.pages.length,
    "Fragments duplicated the full chapter",
  );
  assert.equal(
    new Set(output.ids).size,
    output.ids.length,
    "Duplicate anchor IDs across fragments",
  );
  assert.ok(output.links.length > 0);
  assert.ok(
    output.links.every(
      (link) => link.count === 1 && link.page === output.sourceTargetPage,
    ),
  );
  const ranges = output.pages
    .flatMap((page) => page.ranges)
    .sort((a, b) => a.from - b.from);
  assert.equal(ranges[0].from, 0);
  assert.equal(ranges.at(-1).to, await execute("return planDoc.content.size"));
  ranges.forEach((page, index) => {
    assert.equal(page.size, page.to - page.from);
    if (index) assert.equal(page.from, ranges[index - 1].to);
  });
  const audit = await execute(
    `return (${auditSurface.toString()})('fragments',${JSON.stringify(contract)},{geometry:planGeometry,roots:pageFragments.pages.map(page=>page.element),bounds:pageFragments.pages.map(page=>{const box=page.element.getBoundingClientRect();return {top:box.top+planGeometry.margins.top,bottom:box.bottom-planGeometry.margins.bottom,left:box.left+planGeometry.margins.left,right:box.right-planGeometry.margins.right}})})`,
  );
  const geometry = await execute(`
    const inspect=node=>{const b=node.getBoundingClientRect(),s=getComputedStyle(node);return {tag:node.tagName,cls:node.className,style:node.getAttribute('style'),rect:{top:b.top,left:b.left,width:b.width,height:b.height},position:s.position,margin:s.margin,padding:s.padding}};
    return {source:Array.from(planHost.querySelectorAll('.editor-pagination-furniture')).map(inspect),pages:pageFragments.pages.map(page=>({frame:inspect(page.element),content:inspect(page.content),tables:Array.from(page.element.querySelectorAll('figure[data-type="figureTable"],table,.editor-pagination-furniture')).map(inspect)}))};
  `);
  writeFileSync(
    path.join(folder, "fragment-geometry.json"),
    JSON.stringify(geometry, null, 2),
  );
  writeFileSync(
    path.join(folder, "fragments.json"),
    JSON.stringify({ output: { ...output, html: undefined }, audit }, null, 2),
  );
  for (const [check, passed] of Object.entries(verdict(audit)))
    assert.equal(passed, true, `Fragment quality: ${check}`);
  const failures = await execute(`
    const {PageFragments}=await import('/tests/helpers/legacy-pagination/fragments.ts');
    const host=document.createElement('div');document.body.append(host);
    const aborted=new AbortController();aborted.abort();let cancel=false,midCancel=false,destroyed=false,stale=false,failed=false,geometry=false;
    const resources=[];
    try{await new PageFragments(readOnlyPlan,planGeometry).render(host,aborted.signal)}catch(error){cancel=error.name==='AbortError'&&!host.childNodes.length}
    const mid=new AbortController();const abortObserver=new MutationObserver(()=>mid.abort());abortObserver.observe(host,{childList:true});
    try{await new PageFragments(readOnlyPlan,planGeometry).render(host,mid.signal)}catch(error){midCancel=error.name==='AbortError'&&!host.childNodes.length}finally{abortObserver.disconnect()}
    const disposable=new PageFragments(readOnlyPlan,planGeometry);const destroyObserver=new MutationObserver(()=>disposable.destroy());destroyObserver.observe(host,{childList:true});
    try{await disposable.render(host,new AbortController().signal)}catch(error){destroyed=error.message.includes('changed')&&!host.childNodes.length}finally{destroyObserver.disconnect();disposable.destroy()}
    const image=readOnlyPlan.view.dom.querySelector('img:not(.ProseMirror-separator)');
    if(image){
      const {PaginationImageError}=await import('/src/exception/pagination-image-error.ts');
      const src=image.getAttribute('src');let passed=false;
      const resourceObserver=new MutationObserver(()=>image.setAttribute('src',src+'#changed'));resourceObserver.observe(host,{childList:true});
      try{await new PageFragments(readOnlyPlan,planGeometry).render(host,new AbortController().signal)}catch(error){passed=error instanceof PaginationImageError&&error.code==='pagination.image.changed'&&!host.childNodes.length}finally{resourceObserver.disconnect();image.setAttribute('src',src);await image.decode()}
      resources.push({kind:'image-change',passed});
      const style=image.getAttribute('style');let overflow=false;
      image.style.setProperty('width',(planGeometry.width*2)+'px','important');image.style.setProperty('min-width',(planGeometry.width*2)+'px','important');image.style.setProperty('max-width','none','important');
      try{await new PageFragments(readOnlyPlan,planGeometry).render(host,new AbortController().signal)}catch(error){overflow=error instanceof PaginationImageError&&error.code==='pagination.image.outside-page'&&!host.childNodes.length}finally{if(style===null)image.removeAttribute('style');else image.setAttribute('style',style)}
      resources.push({kind:'image-overflow',passed:overflow});
    }
    const observer=new MutationObserver(()=>readOnlyPlan.applyLayout(planDoc,recordedPlan));observer.observe(host,{childList:true});
    try{await new PageFragments(readOnlyPlan,planGeometry).render(host,new AbortController().signal)}catch(error){stale=error.message.includes('changed')&&!host.childNodes.length}finally{observer.disconnect();host.remove()}
    try{readOnlyPlan.applyLayout(planDoc,{...recordedPlan,error:true})}catch{failed=true}
    const wrong=document.createElement('div');document.body.append(wrong);
    try{await new PageFragments(readOnlyPlan,{...planGeometry,width:planGeometry.width+20}).render(wrong,new AbortController().signal)}catch(error){geometry=error.message.includes('geometry')&&!wrong.childNodes.length}finally{wrong.remove()}
    return {cancel,midCancel,destroyed,stale,failed,geometry,resources};
  `);
  assert.deepEqual(failures, {
    cancel: true,
    midCancel: true,
    destroyed: true,
    stale: true,
    failed: true,
    geometry: true,
    resources: output.imageCount
      ? [
          { kind: "image-change", passed: true },
          { kind: "image-overflow", passed: true },
        ]
      : [],
  });
  writeFileSync(
    path.join(folder, "fragments.json"),
    JSON.stringify(
      { output: { ...output, html: undefined }, audit, failures },
      null,
      2,
    ),
  );
  return {
    ...output,
    audit,
    rejectsStale: failures.stale,
    rejectsFailed: failures.failed,
  };
};

exports.verifyPdf = async ({ pdf, printWindow, output, contract, folder }) => {
  const cells = await printWindow.webContents.executeJavaScript(`
    Array.from(document.querySelectorAll('[data-fragment-cell]'),cell=>{const frame=cell.closest('.editor-page-fragment'),box=cell.getBoundingClientRect(),paper=frame.getBoundingClientRect();return {from:Number(cell.dataset.fragmentCell),page:Array.from(document.querySelectorAll('.editor-page-fragment')).indexOf(frame)+1,left:box.left-paper.left,width:box.width,rowspan:cell.rowSpan,colspan:cell.colSpan}})
  `);
  assert.equal(cells.length, output.cells.length);
  for (const cell of cells) {
    const source = output.cells.find(
      (expected) => expected.from === cell.from && expected.page === cell.page,
    );
    assert.ok(source);
    assert.ok(
      Math.abs(cell.left - source.expectedLeft) < 1 &&
        Math.abs(cell.width - source.expectedWidth) < 1,
      "Print cell geometry changed",
    );
    assert.equal(cell.rowspan, source.rowspan);
    assert.equal(cell.colspan, source.colspan);
  }
  const audit = await printWindow.webContents.executeJavaScript(`
    (${auditSurface.toString()})('fragments',${JSON.stringify(contract)},{
      geometry:${JSON.stringify(output.geometry)},roots:Array.from(document.querySelectorAll('.editor-page-fragment')),
      bounds:Array.from(document.querySelectorAll('.editor-page-fragment'),page=>{
        const box=page.getBoundingClientRect(),margins=${JSON.stringify(output.geometry.margins)};
        return {top:box.top+margins.top,bottom:box.bottom-margins.bottom,left:box.left+margins.left,right:box.right-margins.right};
      })
    })
  `);
  writeFileSync(
    path.join(folder, "print-audit.json"),
    JSON.stringify(audit, null, 2),
  );
  for (const [check, passed] of Object.entries(verdict(audit)))
    assert.equal(passed, true, `Isolated print quality: ${check}`);
  assert.deepEqual(audit.markerPages, output.audit.markerPages);
  const ids = await printWindow.webContents.executeJavaScript(
    "Array.from(document.querySelectorAll('[id]'),node=>node.id)",
  );
  assert.equal(
    new Set(ids).size,
    ids.length,
    "Printed fragment anchors must be unique",
  );
  const destinations = await pdfLinkDestinations(pdf);
  assert.ok(
    destinations.length > 0 &&
      destinations.every((page) => page === output.sourceTargetPage),
    "Native PDF link points to the wrong source page",
  );
};

async function pdfLinkDestinations(bytes) {
  const parsed = await PDFDocument.load(bytes),
    pages = parsed.getPages();
  const destinations = [];
  for (const page of pages)
    for (const reference of page.node.Annots()?.asArray() ?? []) {
      const annotation = parsed.context.lookup(reference, PDFDict);
      const action = annotation.lookupMaybe(PDFName.of("A"), PDFDict);
      const raw =
        annotation.get(PDFName.of("Dest")) ?? action?.get(PDFName.of("D"));
      const value = raw && parsed.context.lookup(raw);
      const named =
        value instanceof PDFName
          ? parsed.catalog.lookup(PDFName.of("Dests"), PDFDict).get(value)
          : undefined;
      const destination = named
        ? parsed.context.lookup(named, PDFArray)
        : value;
      if (destination && !(destination instanceof PDFArray))
        throw Error("Unexpected PDF destination type");
      if (destination)
        destinations.push(
          pages.findIndex(
            (candidate) =>
              candidate.ref.toString() === destination.get(0).toString(),
          ) + 1,
        );
    }
  return destinations;
}
exports.pdfLinkDestinations = pdfLinkDestinations;

async function pdfExternalLinks(bytes) {
  const document = await PDFDocument.load(bytes), result = [];
  for (const [index, page] of document.getPages().entries())
    for (const ref of page.node.Annots()?.asArray() ?? []) {
      const annotation = document.context.lookup(ref, PDFDict);
      const action = annotation.lookupMaybe(PDFName.of("A"), PDFDict);
      if (action?.get(PDFName.of("S"))?.toString() !== "/URI") continue;
      const uri = document.context.lookup(action.get(PDFName.of("URI")));
      result.push({page:index+1,uri:uri.decodeText(),rect:annotation.lookup(PDFName.of("Rect"),PDFArray).asArray().map(value=>Number(value.toString()))});
    }
  return result;
}
exports.pdfExternalLinks = pdfExternalLinks;
