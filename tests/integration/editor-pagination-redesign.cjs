// Discovery evidence for the replacement plan. A recorded defect is not acceptance.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const probes = require('./editor-pagination-redesign-probes.cjs');

async function keyboardSemantics({ execute, until, win }) {
  await execute(`
    setPages(false);
    editor.commands.setContent({type:'doc',content:[{type:'orderedList',content:[{type:'listItem',content:[p('SebelumSesudah')]}]}]});
    const paragraph=[];editor.state.doc.descendants((node,pos)=>{if(node.type.name==='paragraph')paragraph.push(pos)});
    editor.commands.setTextSelection(paragraph[0]+1+'Sebelum'.length);editor.view.focus();
  `);
  win.webContents.sendInputEvent({type:'keyDown',keyCode:'Return',modifiers:['shift']});
  win.webContents.sendInputEvent({type:'keyUp',keyCode:'Return',modifiers:['shift']});
  await until("editor.getJSON().content.some(node=>node.type==='orderedList'&&JSON.stringify(node).includes('hardBreak'))");
  const shiftEnter = await execute('return editor.getJSON()');
  win.webContents.sendInputEvent({type:'keyDown',keyCode:'Return'});
  win.webContents.sendInputEvent({type:'keyUp',keyCode:'Return'});
  await until("editor.getJSON().content.find(node=>node.type==='orderedList')?.content.length===2");
  const enter = await execute('return editor.getJSON()');
  const list = shiftEnter.content.find(node => node.type === 'orderedList');
  assert.equal(list.content.length, 1);
  assert.equal(list.content[0].content.length, 1);
  assert.equal(list.content[0].content[0].content.filter(node => node.type === 'hardBreak').length, 1);
  return { shiftEnter, enter, verified: 'Native Shift+Enter inserts hardBreak within the same list paragraph; Enter splits the list item.' };
}

async function captureContext({ execute, editorPDFTest, artifacts }, name, target) {
  console.log('Redesign reproduction:', name);
  if (target === 'applicationEditor') {
    fs.writeFileSync(path.join(artifacts, name + '-live-images.json'), JSON.stringify(await execute(`
      const {paginationGeometry}=await import('/src/editor/pagination/options.ts');
      const state=archivePaginationKey.getState(applicationEditor.state);
      return redesignAuditView(applicationEditor.state.doc,applicationEditor.view,state.layout,paginationGeometry(state.options));
    `), null, 2));
  }
  const result = await execute(`
    redesignImageAudit.length=0;
    const before=await archiveSavedSource(archiveContext.id);
    const task=new AbortController(),timer=setTimeout(()=>task.abort(new Error('Context capture deadline')),45000);
    try {
      window.redesignSnapshot=await archiveCapture(${target},task.signal);
      return {ok:true,pages:redesignSnapshot.pages,sections:redesignSnapshot.sections,sourceHash:redesignSnapshot.sourceHash,planHash:redesignSnapshot.planHash,fingerprint:redesignSnapshot.fingerprint,sourceUnchanged:before===await archiveSavedSource(archiveContext.id)};
    } catch(error) {
      return {ok:false,message:error.message,code:error.code,details:error.cause?.details??error.details,diagnostic:error.diagnostic,sourceUnchanged:before===await archiveSavedSource(archiveContext.id)};
    } finally {clearTimeout(timer)}
  `);
  assert.equal(result.sourceUnchanged, true, 'Capture wrote source');
  fs.writeFileSync(path.join(artifacts, name + '-images.json'), JSON.stringify(await execute('return redesignImageAudit'), null, 2));
  if (result.ok) {
    fs.writeFileSync(path.join(artifacts, name + '.html'), await execute('return redesignSnapshot.html'));
    await execute('await window.editorPDFExperimental.export(redesignSnapshot,crypto.randomUUID())');
    fs.copyFileSync(editorPDFTest.outputs.at(-1), path.join(artifacts, name + '.pdf'));
  }
  return result;
}

async function compositionProbe(execute) {
  return execute(`
    const {prepareDocumentExport}=await import('/src/document-export/source/prepare-document.ts');
    const {DocumentSections}=await import('/src/document-engine/adapters/current-category.tsx');
    const input=await prepareDocumentExport(archiveContext,new AbortController().signal);
    // Deliberate metadata on a detached snapshot, never write the imported source.
    const data=structuredClone(input.data);
    data.keywords={indonesian:['BUKTIKATAKUNCIID'],english:['PROOFKEYWORDEN']};
    const parts=new DocumentSections({document:data,category:input.category,model:{...input.model,document:data}});
    try {
      return ['abstract','abstract-en'].map(id=>{
        const section=parts.sections.find(section=>section.id===id);
        const expected=id==='abstract'?'BUKTIKATAKUNCIID':'PROOFKEYWORDEN';
        return {id,kind:section?.kind,expected,retained:JSON.stringify(section).includes(expected),section};
      });
    } finally {parts.destroy()}
  `);
}

async function recordAbstractLayout({ execute, until }) {
  const result = [];
  for (const chapter of ['abstract', 'abstract-en']) {
    await execute(`window.navigate('/document/'+archiveContext.id+'/${chapter}')`);
    await until(`window.applicationEditor&&!applicationEditor.isDestroyed&&window.applicationChapter()===archiveContext.id+'.${chapter}'&&document.querySelector('[data-tour="editor-keywords"]')?.querySelectorAll('button').length===5&&!archivePaginationKey.getState(applicationEditor.state).pending`);
    result.push(await execute(`
      const root=applicationEditor.view.dom,paper=root.closest('.page'),origin=paper.getBoundingClientRect();
      const keyword=document.querySelector('[data-tour="editor-keywords"]');
      const rect=node=>{const box=node.getBoundingClientRect();return {top:box.top-origin.top,left:box.left-origin.left,width:box.width,height:box.height}};
      return {chapter:'${chapter}',paper:rect(paper),body:rect(root),headings:Array.from(root.querySelectorAll('h1,h2,h3'),node=>({text:node.textContent,rect:rect(node)})),keywords:{insideEditor:root.contains(keyword),text:keyword.textContent,rect:rect(keyword),buttons:keyword.querySelectorAll('button').length},sourceUnchanged:archiveBefore===await archiveSavedSource(archiveContext.id)};
    `));
  }
  return result;
}

async function recordAbstractReference(execute) {
  return execute(`
    const {prepareDocumentExport}=await import('/src/document-export/source/prepare-document.ts');
    const {legacyAbstractComposition}=await import('/tests/helpers/legacy-abstract-composition.tsx');
    const input=await prepareDocumentExport(archiveContext,new AbortController().signal);
    const references=legacyAbstractComposition({document:input.data,category:input.category,model:input.model});
    const host=document.createElement('div');host.className='document-template-content';host.style.cssText='position:absolute;left:-100000px;top:0;width:'+input.baseGeometry.contentWidth+'px';
    document.body.append(host);
    try {
      const results=[];
      for(const reference of references){
        host.replaceChildren(reference.section);await document.fonts.ready;
        const origin=host.getBoundingClientRect(),rect=node=>{const box=node.getBoundingClientRect();return {top:box.top-origin.top,left:box.left-origin.left,width:box.width,height:box.height}};
        const children=Array.from(reference.section.children),index=children.indexOf(reference.body);
        results.push({chapter:reference.chapter,role:'Existing template composition reference, not replacement body renderer',width:origin.width,
          prefix:children.slice(0,index).map(node=>({tag:node.tagName,text:node.textContent,rect:rect(node)})),body:rect(reference.body),suffix:children.slice(index+1).map(node=>({tag:node.tagName,text:node.textContent,rect:rect(node)})),html:reference.section.outerHTML});
      }
      return results;
    } finally {host.remove()}
  `);
}

exports.run = async context => {
  const { execute, until, artifacts, files, importArchive } = context;
  const report = {
    purpose: 'Freeze failure reproductions before replacement implementation; successful recording does not mean acceptance.',
    environment: { platform: process.platform, architecture: process.arch, versions: process.versions, cpu: os.cpus()[0]?.model, memoryBytes: os.totalmem() },
    thresholds: { glyphCSSPixels: 0.75, nativeTextXPoints: 1.5, nativeTextYPoints: 2, pageBreakDifferenceAllowed: 0, missingOrReorderedContentAllowed: 0 },
  };
  const save = () => fs.writeFileSync(path.join(artifacts, 'redesign-reproduction.json'), JSON.stringify(report, null, 2));
  save();
  try {
    report.schema = await execute(`return await (${probes.schemaInventory.toString()})()`);
    report.keyboard = await keyboardSemantics(context);
    report.hardBreak = await execute(`return (${probes.hardBreakBrowserProbe.toString()})()`);
    report.hardBreakFragments = await require('./editor-pagination-redesign-br.cjs').recordHardBreakFragments(context);
    save();
    const file = files.find(file => file.label === 'doc-03');
    assert(file, 'The explicitly selected local reproduction archive is required');
    report.input = { label: file.label, archiveSha256: file.originalHash, ...await importArchive(execute, file) };
    report.composition = await compositionProbe(execute);
    report.abstractReference = await recordAbstractReference(execute);
    await execute(`window.redesignAuditView=${probes.auditView.toString()};await (${probes.installImageAudit.toString()})()`);
    report.contexts = {};
    const requested = process.env.HIGHTEX_PAGINATION_REDESIGN_CONTEXTS?.split(',');
    if (!requested || requested.includes('document')) report.contexts.document = await captureContext(context, 'document', 'archiveContext');
    save();
    await execute(`await window.config.set({editor:{pagination:true}});window.mountApplication('/document/'+archiveContext.id+'/1')`);
    for (const chapter of ['1', '4', '1']) {
      const name = chapter === '1' && report.contexts.active1 ? 'active1-return' : 'active' + chapter;
      if (name !== 'active1') await execute(`window.navigate('/document/'+archiveContext.id+'/${chapter}')`);
      if (requested && !requested.includes(name)) continue;
      await until(`window.applicationEditor&&!applicationEditor.isDestroyed&&window.applicationChapter()===archiveContext.id+'.${chapter}'&&applicationLayout()&&!applicationLayout().error&&!archivePaginationKey.getState(applicationEditor.state).pending`,25000);
      report.contexts[name] = await captureContext(context, name, 'applicationEditor');
      save();
    }
    report.abstractPresentation = await recordAbstractLayout(context);
    console.log('RECORDED: schema, native list keys, BR layout, abstract composition and active chapter permutations. Inspect defects in:', artifacts);
  } finally {
    report.rendererErrors = await execute('return window.errors').catch(error => [error.message]);
    save();
  }
};

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  process.env.HIGHTEX_EDITOR_PDF_PIPELINE = '1';
  process.env.HIGHTEX_EDITOR_PDF_ARCHIVES = '1';
  process.env.HIGHTEX_PAGINATION_REDESIGN = '1';
  process.env.HIGHTEX_PAGINATION_DOCUMENT_FILTER = 'doc-03';
  require('./editor-pagination.cjs');
}
