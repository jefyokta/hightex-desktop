// Focused readiness evidence for current table widths, CSS and actual error reporting.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

exports.run=async context=>{
  const {execute,until,artifacts,win}=context;
  const baseline=Boolean(process.env.HIGHTEX_READY_BASELINE);
  const report={baseline,edits:[]};
  const save=()=>fs.writeFileSync(path.join(artifacts,'pagination-ready.json'),JSON.stringify(report,null,2));
  console.log('Readiness artifacts:',artifacts);
  if(!baseline&&!process.env.HIGHTEX_READY_NATIVE_ONLY){
    report.error=await execute(`
      const {PaginationView}=await import('/src/editor/pagination/view.ts');
      const {ShouldReport}=await import('/src/exception/should-report.ts');
      const {Manager}=await import('/src/editor/manager/index.ts');
      const originalUpdate=PaginationView.prototype.update;
      PaginationView.prototype.update=function(...args){window.readinessView=this;return originalUpdate.apply(this,args)};
      editor.commands.setEditorPagination(false);editor.commands.setEditorPagination(true);
      PaginationView.prototype.update=originalUpdate;
      window.readinessError={cause:new Error('READINESS-ERROR-CAUSE'),before:JSON.stringify(editor.getJSON()),reportsBefore:feedbackTest.reports.length};
      const stop=Manager.app.onError(({error})=>{
        if(error instanceof ShouldReport&&error.cause===readinessError.cause){
          readinessError.received={instance:true,cause:true,id:error.id,description:error.description,hasAction:!!error.action};
          readinessError.string=String(error);
        }
      });
      readinessError.stop=stop;readinessError.original=readinessView.compileChapter;
      readinessView.compileChapter=async()=>{throw readinessError.cause};
      return {armed:true};
    `);
    await until('window.readinessError.received&&layout().error');
    report.error=await execute(`
      const e=readinessError;
      const expected=errors.filter(value=>value===e.string);if(expected.length!==1)throw Error('Expected exactly one observed injected report');
      errors.splice(errors.indexOf(e.string),1);
      readinessView.compileChapter=e.original;e.stop();editor.commands.configureEditorPagination({margins:{top:30}});
      editor.commands.setEditorPagination(false);editor.commands.setEditorPagination(true);
      return {...e.received,noAutomaticSubmission:feedbackTest.reports.length===e.reportsBefore,sourceUnchanged:e.before===JSON.stringify(editor.getJSON())};
    `);
    assert.equal(report.error.instance,true);assert.equal(report.error.cause,true);assert.equal(report.error.id,'pagination-layout:fixture.1');
    assert.equal(report.error.hasAction,true);assert.equal(report.error.noAutomaticSubmission,true);assert.equal(report.error.sourceUnchanged,true);
    await until('layoutReady()&&!layout().error');save();
  }
  const edit=async({variant})=>{
    const before=await execute('return JSON.stringify(editor.getJSON())');
    if(variant!=='one-pixel'){
      const selector=variant==='merged'?'table':'figure[data-type="figureTable"] table table';
      const point=await execute(`const table=editor.view.dom.querySelector(${JSON.stringify(selector)}),cell=table.rows[0].cells[0];cell.scrollIntoView({block:'center'});await new Promise(requestAnimationFrame);const box=cell.getBoundingClientRect();return {x:Math.round(box.right-2),y:Math.round(box.top+Math.min(12,box.height/2))}`);
      await execute('closeHistory()');
      win.webContents.sendInputEvent({type:'mouseMove',...point});await execute('await new Promise(requestAnimationFrame)');
      win.webContents.sendInputEvent({type:'mouseDown',...point,button:'left',clickCount:1});
      const target={x:point.x+(variant==='merged'?30:-15),y:point.y};
      win.webContents.sendInputEvent({type:'mouseMove',...target,modifiers:['leftButtonDown']});
      await execute('await new Promise(requestAnimationFrame)');
      assert.equal(await execute('return document.body.classList.contains("table-column-resizing")'),true);
      win.webContents.sendInputEvent({type:'mouseUp',...target,button:'left',clickCount:1});
      await execute('await waitSaved()');await until('layoutReady()&&!layout().error');
      const resized=await execute('return JSON.stringify(editor.getJSON())');assert.notEqual(resized,before,'Resize did not edit source');
      await execute(`closeHistory();let position;editor.state.doc.descendants((node,pos)=>{if(position===undefined&&node.type.name==='tableHeader'&&${variant==='merged'?"node.attrs.colspan===2":"true"})position=pos});if(!editor.commands.applyCellWidthToTable(position))throw Error('Apply-all unavailable');await waitSaved()`);
      await until('layoutReady()&&!layout().error');
      const applied=await execute('return JSON.stringify(editor.getJSON())');
      await execute('editor.commands.undo();await waitSaved()');assert.equal(await execute('return JSON.stringify(editor.getJSON())'),resized);
      await execute('editor.commands.undo();await waitSaved()');assert.equal(await execute('return JSON.stringify(editor.getJSON())'),before);
      await execute('editor.commands.redo();editor.commands.redo();await waitSaved()');await until('layoutReady()&&!layout().error');
      assert.equal(await execute('return JSON.stringify(editor.getJSON())'),applied);
      report.edits.push({variant,undoRedo:true,bodyCursorClean:await execute('return !document.body.classList.contains("table-column-resizing")')});
    }
    report.edits.push(await execute(`return {variant:${JSON.stringify(variant)},pages:layout().pages,stored:JSON.stringify((await db.chapters.get('fixture.1')).content)===JSON.stringify(editor.getJSON().content),lists:Array.from(editor.view.dom.querySelectorAll('ol')).map(list=>({start:list.start,padding:getComputedStyle(list).paddingLeft,type:getComputedStyle(list).listStyleType})),source:editor.getJSON()}`));save();
  };
  if(baseline||process.env.HIGHTEX_READY_COMPARE){
    const {measureContent,measureTableContent,compareContent,compareTableContent}=require('./editor-pdf-geometry.cjs');
    report.layouts=[];
    for(const variant of ['merged','nested','one-pixel']){
      await execute(`setPages(false);const {paginationReadyInput}=await import('/tests/helpers/pagination-ready-input.ts');const nodes=paginationReadyInput(${JSON.stringify(variant)});editor.commands.setContent({type:'doc',content:[{type:'heading',attrs:{level:1},content:[{type:'text',text:'Matrix native'}]},...nodes]});await waitSaved();setPages(true)`);
      await until('layoutReady()&&!layout().error');await edit({variant});
      report.layouts.push(await execute(`const paper=editor.view.dom.closest('.page'),geometry=paginationGeometry();return {variant:${JSON.stringify(variant)},pages:layout().pages,content:(${measureContent.toString()})([{root:editor.view.dom,paper},...Array.from(paper.querySelectorAll('.editor-pagination-furniture'),root=>({root,paper}))],geometry),table:(${measureTableContent.toString()})(paper,geometry)}`));save();
    }
    if(process.env.HIGHTEX_READY_COMPARE){
      const prior=JSON.parse(fs.readFileSync(process.env.HIGHTEX_READY_COMPARE,'utf8'));
      report.cssComparison=report.layouts.map((layout,index)=>{
        assert.equal(layout.pages,prior.layouts[index].pages);
        return {variant:layout.variant,pages:layout.pages,content:compareContent(prior.layouts[index].content,layout.content,0),table:compareTableContent(prior.layouts[index].table,layout.table,0)};
      });save();
    }
  }
  if(!baseline){
    await require('./editor-section-pdf.cjs').run(context,{cases:process.env.HIGHTEX_READY_CASES?.split(',')??['merged','nested','one-pixel'],modes:['both'],inputModule:'/tests/helpers/pagination-ready-input.ts',inputFunction:'paginationReadyInput',reportName:'pagination-ready-native.json',generatedText:'7.c.8.',beforeCapture:edit});
    report.native=JSON.parse(fs.readFileSync(path.join(artifacts,'pagination-ready-native.json'),'utf8'));
    assert.ok(report.native.cases.every(item=>item.pages>1),'Fixture must exercise multipage tables');
  }
  report.errors=await execute('return errors');assert.deepEqual(report.errors,[]);save();console.log('PASS focused pagination readiness:',artifacts);
};
if(process.argv[1]&&path.resolve(process.argv[1])===__filename){process.env.HIGHTEX_PAGINATION_READY='1';process.env.HIGHTEX_EDITOR_PDF_PIPELINE='1';require('./editor-pagination.cjs')}
