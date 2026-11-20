const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

exports.run = async context => {
  const { execute, until, artifacts, win } = context;
  const report = {};
  const save = () => fs.writeFileSync(path.join(artifacts,'editing-workflow.json'),JSON.stringify(report,null,2));
  try {
    if(!process.env.HIGHTEX_WORKFLOW_LIFECYCLE_ONLY) {
      await require('./editor-pagination-clipboard.cjs').runClipboard({...context, print:false});
      report.clipboard = true;save();
      await require('./editor-pagination-ime.cjs').runIME({...context, print:false});
      report.ime = true;save();
    }
    // Remount through the normal create/storage owner after the IME teardown case.
    await execute('window.mountChapterFixture()');
    await until('window.ready&&editor&&!editor.isDestroyed');
    await execute(`
      setPages(false);
      const {complexTableInput}=await import('/tests/helpers/complex-table-input.ts');
      const input={type:'doc',content:[
        {type:'heading',attrs:{level:1,id:'workflow-heading'},content:[{type:'text',text:'Workflow'}]},
        {type:'orderedList',content:[{type:'listItem',content:[p('Daftar sebelum edit')]}]},
        {type:'codeBlock',attrs:{language:'javascript'},content:[{type:'text',text:'const preserved = true;'}]},
        ...complexTableInput('adjacent-nested'),
        {type:'imageFigure',attrs:{id:'workflow-image'},content:[{type:'image',attrs:{src:'fixture-image',width:200}},
          {type:'figcaption',content:[{type:'text',text:'Caption workflow'}]}]},
        p('WORKFLOW-END')
      ]};
      editor.commands.setContent(input);await waitSaved();await prepareComparison(editor.getJSON());setPages(true);
    `);
    const ready = () => until('layoutReady()&&!layout().error&&!document.querySelector("[data-pagination-measure]")');
    await ready();
    await until('Array.from(editor.view.dom.querySelectorAll(".node-image")).every(node=>node.dataset.imageStatus==="ready")');
    await execute(`
      window.workflowImage=editor.view.dom.querySelector('.node-image img');
      window.workflowImageSource=workflowImage.src;window.workflowImageMutations=[];
      window.workflowImageObserver=new MutationObserver(records=>workflowImageMutations.push(...records.map(record=>record.oldValue)));
      workflowImageObserver.observe(workflowImage,{attributes:true,attributeFilter:['src'],attributeOldValue:true});
    `);
    report.controls = await execute(`
      const code=[];editor.state.doc.descendants((node,pos)=>{if(node.type.name==='codeBlock')code.push(pos)});
      const nodeDOM=editor.view.nodeDOM(code[0]),content=nodeDOM.querySelector('code');
      closeHistory();editor.commands.setTextSelection(code[0]+1);editor.view.focus();
      const selection=JSON.stringify(editor.state.selection.toJSON());
      editor.commands.updateAttributes('codeBlock',{language:'typescript'});
      await waitSaved();
      window.workflowSource=editor.state.doc;window.workflowSelection=JSON.stringify(editor.state.selection.toJSON());
      return {domStable:nodeDOM===editor.view.nodeDOM(code[0]),contentStable:content===nodeDOM.querySelector('code'),
        text:content.textContent==='const preserved = true;',selection:selection===workflowSelection,
        controls:nodeDOM.querySelectorAll('[data-editor-node-controls]').length,
        stored:JSON.stringify((await db.chapters.get('fixture.1')).content)===JSON.stringify(editor.getJSON().content)};
    `);
    for (const [key,value] of Object.entries(report.controls))assert.equal(value,key==='controls'?1:true,'NodeView '+key);
    await ready();
    report.history = await execute(`
      const code=[];editor.state.doc.descendants((node,pos)=>{if(node.type.name==='codeBlock')code.push({node,pos})});
      closeHistory();editor.commands.undo();const undo=editor.state.doc.nodeAt(code[0].pos).attrs.language==='javascript';
      editor.commands.redo();const redo=editor.state.doc.eq(workflowSource);await waitSaved();
      const source=editor.state.doc,selection=JSON.stringify(editor.state.selection.toJSON()),history=JSON.stringify(historyDepth());
      setPages(false);setPages(true);
      return {undo,redo,source:editor.state.doc.eq(source),selection:selection===JSON.stringify(editor.state.selection.toJSON()),
        history:history===JSON.stringify(historyDepth())};
    `);
    for(const [key,value] of Object.entries(report.history))assert.equal(value,true,'History/toggle '+key);
    await ready();
    report.imageResource = await execute(`
      workflowImageObserver.disconnect();
      return {sameElement:workflowImage===editor.view.dom.querySelector('.node-image img'),
        sameSource:workflowImageSource===workflowImage.src,sourceChanges:workflowImageMutations.length,
        ready:workflowImage.closest('.node-image').dataset.imageStatus==='ready'};
    `);
    assert.deepEqual(report.imageResource,{sameElement:true,sameSource:true,sourceChanges:0,ready:true},'Layout/controls updates reloaded an unchanged image');
    await execute(`window.workflowSaved=JSON.stringify(editor.getJSON());window.workflowOldDOM=editor.view.dom;window.mountChapterFixture()`);
    await until('window.ready&&editor&&!editor.isDestroyed&&editor.view.dom!==workflowOldDOM');
    await execute('setPages(true)');await ready();
    report.reopen = await execute(`return {source:workflowSaved===JSON.stringify(editor.getJSON()),
      stored:JSON.stringify((await db.chapters.get('fixture.1')).content)===JSON.stringify(editor.getJSON().content),
      chrome:editor.view.dom.closest('.page').querySelectorAll('.editor-pagination-sheets').length,
      controls:editor.view.dom.querySelectorAll('[data-editor-node-controls]').length>0}`);
    if(!report.reopen.source||!report.reopen.stored)
      fs.writeFileSync(path.join(artifacts,'reopen-source.json'),JSON.stringify(await execute(`return {before:JSON.parse(workflowSaved),after:editor.getJSON(),stored:(await db.chapters.get('fixture.1')).content}`),null,2));
    assert.equal(report.reopen.source,true);assert.equal(report.reopen.stored,true);
    assert.equal(report.reopen.chrome,1);assert.equal(report.reopen.controls,true);save();
    await execute("document.querySelector('[data-pagination-status]').scrollIntoView({block:'start'})");
    fs.writeFileSync(path.join(artifacts,'pagination-toolbar-idle.png'),(await win.webContents.capturePage()).toPNG());
    report.options=await require('./editor-pagination-ui.cjs').reviewExportOptions(context);save();
    const persisted = await execute(`await waitSaved();return {source:JSON.stringify(editor.getJSON()),timeOrigin:performance.timeOrigin,errors:window.errors}`);
    assert.deepEqual(persisted.errors,[]);
    await execute('db.close()');
    const loaded = new Promise((resolve,reject)=>{
      const done=()=>{clearTimeout(timer);win.webContents.removeListener('did-finish-load',done);resolve()};
      const timer=setTimeout(()=>{win.webContents.removeListener('did-finish-load',done);reject(Error('Workflow renderer reload deadline (20 seconds)'))},20000);
      win.webContents.once('did-finish-load',done);
    });
    win.webContents.reload();await loaded;
    await until('window.ready&&editor&&!editor.isDestroyed');
    await execute('setPages(true)');await ready();
    report.reload = await execute(`return {source:JSON.stringify(editor.getJSON()),timeOrigin:performance.timeOrigin,
      stored:JSON.stringify((await db.chapters.get('fixture.1')).content)===JSON.stringify(editor.getJSON().content),
      editable:editor.isEditable,chrome:editor.view.dom.closest('.page').querySelectorAll('.editor-pagination-sheets').length}`);
    assert.equal(report.reload.source,persisted.source);assert.notEqual(report.reload.timeOrigin,persisted.timeOrigin);
    assert.equal(report.reload.stored,true);assert.equal(report.reload.editable,true);assert.equal(report.reload.chrome,1);
    report.reload = {source:true,rendererRecreated:true,stored:true,editable:true,chrome:1};save();
    // Queue a new revision and destroy before publication, exercising abort cleanup.
    await execute(`editor.commands.insertContent(' cleanup');editor.destroy()`);
    await new Promise(resolve=>setTimeout(resolve,250));
    report.cleanup = await execute(`return {owned:document.querySelectorAll('[data-pagination-measure],[data-pagination-surface],.editor-pagination-sheets,[data-editor-node-controls]').length,errors:window.errors}`);
    assert.equal(report.cleanup.owned,0);assert.deepEqual(report.cleanup.errors,[]);
    report.passed=true;save();console.log('PASS editing workflow:',artifacts,JSON.stringify(report));
  } catch(error) {
    report.failure={message:error.message,stack:error.stack};
    report.state=await execute(`
      const {paginationKey}=await import('/src/editor/pagination/index.ts');
      const {getEditorChapter}=await import('/src/editor/event/index.ts');
      const state=window.editor&&!editor.isDestroyed&&paginationKey.getState(editor.state);
      return {ready:window.ready,editor:!!window.editor,destroyed:window.editor?.isDestroyed,
        editable:window.editor?.isEditable,chapter:window.editor&&getEditorChapter(editor)?.getId(),
        enabled:state?.enabled,pending:state?.pending,error:state?.error,pages:state?.layout.pages,
        fonts:document.fonts.status,composing:window.editor?.view.composing,visibility:document.visibilityState,
        frame:window.workflowReloadFrame,
        scheduler:window.workflowPaginationView&&{destroyed:workflowPaginationView.destroyed,
          timer:workflowPaginationView.timer,frame:workflowPaginationView.frame,
          sameView:workflowPaginationView.view===editor.view,chapter:workflowPaginationView.sources.chapter?.getId()},
        measuring:document.querySelectorAll('[data-pagination-measure]').length,trace:window.workflowLayoutTrace,
        images:Array.from(document.querySelectorAll('.node-image'),node=>({status:node.dataset.imageStatus,
          ready:node.querySelector('img')?.complete})),errors:window.errors};
    `).catch(error=>({unavailable:error.message}));
    save();throw error;
  }
};
