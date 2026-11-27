// Only the new context-menu width action, with isolated source/persistence and one native PDF.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { BrowserWindow } = require('electron');

exports.run = async context => {
  const {execute,until,artifacts}=context;
  const report={cases:[]};
  const save=()=>fs.writeFileSync(path.join(artifacts,'cell-width-apply.json'),JSON.stringify(report,null,2));
  await execute(`
    const {mountTableWidthContextMenu,setCurrentLanguage,t}=await import('/tests/helpers/table-width-context-menu.tsx');
    setCurrentLanguage('id');window.widthApplyLabel=t('editor.context_menu.apply_cell_width_to_all');
    window.unmountWidthMenu=mountTableWidthContextMenu(editor);
    window.applyWidthState=()=>{
      const tables=[];editor.state.doc.descendants((node,pos)=>{if(node.type.spec.tableRole!=='table')return;
        const cells=[];node.forEach(row=>row.forEach(cell=>cells.push({colwidth:cell.attrs.colwidth,colspan:cell.attrs.colspan,rowspan:cell.attrs.rowspan})));
        const dom=editor.view.nodeDOM(pos).querySelector('table');tables.push({pos,cells,width:parseFloat(getComputedStyle(dom).width),available:parseFloat(getComputedStyle(dom.parentElement).width)});
      });return {source:JSON.stringify(editor.getJSON()),tables,selection:editor.state.selection.toJSON()};
    };
  `);
  const win=BrowserWindow.getAllWindows().find(window=>window.webContents.getURL().endsWith('/'));
  const withoutWidths=value=>JSON.parse(JSON.stringify(value),(key,item)=>key==='colwidth'?undefined:item);
  async function setup(variant,merged=false) {
    await execute(`
      setPages(false);const {tableWidthInput}=await import('/tests/helpers/table-width-input.ts');const content=tableWidthInput(${JSON.stringify(variant)});
      ${merged?`const cells=content[0].content[1].content[0].content;cells[0].attrs={colspan:2,colwidth:[120,160]};cells.splice(1,1);`:''}
      editor.commands.setContent({type:'doc',content:[{type:'heading',attrs:{level:1},content:[{type:'text',text:'Apply cell width'}]},...content]});await waitSaved();setPages(true);
    `);
    await until('layoutReady()&&!layout().error');
  }
  async function apply(name,tableIndex,rowIndex,column) {
    await execute('closeHistory()');
    const before=await execute('return applyWidthState()');
    await execute(`
      const table=editor.view.dom.querySelectorAll('table')[${tableIndex}],cell=table.rows[${rowIndex}].cells[${column}],target=cell.querySelector('p')??cell;
      target.scrollIntoView({block:'center'});await new Promise(requestAnimationFrame);
      const box=target.getBoundingClientRect();target.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:box.left+Math.min(8,box.width/2),clientY:box.top+box.height/2}));
    `);
    await until(`Array.from(document.querySelectorAll('[data-editor-context-menu] button')).some(button=>button.textContent.trim()===widthApplyLabel)`);
    await until(`getComputedStyle(document.querySelector('[data-editor-context-menu]')).opacity==='1'`);
    assert.equal((await execute('return applyWidthState()')).source,before.source,'Opening the menu changed source');
    if(name==='body')fs.writeFileSync(path.join(artifacts,'cell-width-apply-menu.png'),(await win.webContents.capturePage()).toPNG());
    await execute(`const button=Array.from(document.querySelectorAll('[data-editor-context-menu] button')).find(button=>button.textContent.trim()===widthApplyLabel);if(button.disabled)throw Error('Width action disabled');button.click();await waitSaved()`);
    await until('layoutReady()&&!layout().error');
    const after=await execute('return applyWidthState()');
    const item={name,before,after};report.cases.push(item);save();
    assert.deepEqual(withoutWidths(JSON.parse(after.source)),withoutWidths(JSON.parse(before.source)),name+': changed structure/content/IDs');
    assert.ok(after.tables[tableIndex].width<=after.tables[tableIndex].available,name+': outside container');
    await execute('editor.commands.undo();await waitSaved()');await until('layoutReady()&&!layout().error');
    assert.equal((await execute('return applyWidthState()')).source,before.source,name+': undo');
    await execute('editor.commands.redo();await waitSaved()');await until('layoutReady()&&!layout().error');
    assert.equal((await execute('return applyWidthState()')).source,after.source,name+': redo');
    assert.equal(await execute(`return JSON.stringify((await db.chapters.get('fixture.1')).content)===JSON.stringify(editor.getJSON().content)`),true,name+': persistence');
    return item;
  }
  try {
    await setup('fixed');
    const body=await apply('body',0,1,1);
    assert.ok(body.after.tables[0].cells.every(cell=>cell.colwidth[0]===160));
    if(process.env.HIGHTEX_TABLE_WIDTHS_APPLY_MENU_ONLY){save();console.log('PASS width context menu screenshot:',artifacts);return;}
    await setup('fixed');
    const header=await apply('header',0,0,2);
    assert.ok(header.after.tables[0].cells.every(cell=>cell.colwidth[0]===180));
    await setup('fixed',true);
    const merged=await apply('merged-header',0,0,0);
    assert.ok(merged.after.tables[0].cells.every(cell=>cell.colwidth.every(width=>width===140)));
    assert.equal(merged.after.tables[0].cells[0].colspan,2);
    await setup('nested');
    const nested=await apply('nested-header',1,0,0);
    assert.deepEqual(nested.after.tables[0].cells,nested.before.tables[0].cells,'Nested header action changed enclosing table');
    assert.ok(nested.after.tables[1].cells.every(cell=>cell.colwidth.every(width=>width<300)));
    report.outsideTable=await execute(`editor.commands.setTextSelection(editor.state.doc.content.size-1);return editor.can().applyCellWidthToTable()`);
    assert.equal(report.outsideTable,false);
    await require('./editor-section-pdf.cjs').run(context,{
      cases:['fixed'],modes:['both'],inputModule:'/tests/helpers/table-width-input.ts',inputFunction:'tableWidthInput',reportName:'cell-width-apply-pdf.json',
      beforeCapture:async()=>{await apply('native-body',0,1,1)},
    });
    report.errors=await execute('return window.errors');assert.deepEqual(report.errors,[]);
    save();console.log('PASS apply cell width context menu:',artifacts);
  } finally { await execute('unmountWidthMenu()'); }
};

if(process.argv[1]&&path.resolve(process.argv[1])===__filename){
  process.env.HIGHTEX_TABLE_WIDTHS_APPLY='1';
  process.env.HIGHTEX_TABLE_WIDTHS='1';process.env.HIGHTEX_EDITOR_PDF_PIPELINE='1';require('./editor-pagination.cjs');
}
